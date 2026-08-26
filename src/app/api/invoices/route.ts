import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFiscalDocument } from "@/lib/nfse/issuance/domain";
import { getNFSeProvider } from "@/lib/nfse/issuance/provider";
import { parseMoneyToCents } from "@/lib/validation/money";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { logEvent } from "@/lib/observability/logger";
import { requireSessionOrganization } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFiscalConfiguration } from "@/lib/nfse/fiscal-rule-resolver";
import { SafeFiscalError } from "@/lib/nfse/errors";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ serviceTemplateId:z.uuid(), customerId:z.uuid(), amount:z.union([z.string(),z.number()]), serviceDate:z.iso.date(), description:z.string().trim().min(3).max(1000), scenario:z.enum(["success","rejection","timeout"]).optional() });

export async function POST(request:Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length < 16) return NextResponse.json({ error:"Chave de idempotência ausente ou inválida." },{ status:400 });
  try {
    assertRateLimit(`issue:${request.headers.get("x-forwarded-for") ?? "local"}`);
    const body = schema.parse(await request.json());
    // Isolated local demonstration never receives browser-supplied organization data.
    if (process.env.NFSE_PROVIDER !== "national" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const document=buildFiscalDocument({organization:{id:"local-mock",taxId:"00000000000000",municipalRegistration:"ISENTO",municipalityCode:"0000000"},customer:{legalName:"Tomador de demonstração"},service:{nationalTaxCode:"000000"},taxConfiguration:{regime:"SIMPLES_NACIONAL",taxationType:"MUNICIPAL",iss:{withheld:false,source:"OFFICE_PARAMETER"},ibsCbs:{customerFieldsEnabled:false}},amountCents:parseMoneyToCents(body.amount),serviceDate:body.serviceDate,description:body.description,dpsNumber:1n,dpsSeries:"00001"});
      const result=await getNFSeProvider().issue({document,idempotencyKey,scenario:body.scenario});
      return NextResponse.json({...result,invoiceId:result.status==="ISSUED"?result.nfseNumber:undefined},{status:result.status==="UNKNOWN"?202:result.status==="REJECTED"?422:201,headers:{"X-Request-ID":requestId}});
    }
    const session=await requireSessionOrganization();
    const admin=createAdminClient();
    const [{data:organization},{data:customer},{data:service},{data:profile}]=await Promise.all([
      admin.from("organizations").select("id,tax_id,municipal_registration,municipality_code,status,emission_blocked").eq("id",session.organizationId).single(),
      admin.from("customers").select("id,tax_id,legal_name").eq("id",body.customerId).eq("organization_id",session.organizationId).single(),
      admin.from("service_templates").select("id,national_tax_code,municipal_service_code,municipal_service_mapping_id,national_service_code_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,reviewed_at,active").eq("id",body.serviceTemplateId).eq("organization_id",session.organizationId).eq("active",true).single(),
      admin.from("tax_profiles").select("tax_regime,reviewed_at,iss_configuration,dps_configuration").eq("organization_id",session.organizationId).single()
    ]);
    if(!organization||!customer||!service||!profile||organization.emission_blocked||organization.status!=="ACTIVE"||!profile.reviewed_at||!getServiceReadiness(service).ready) return NextResponse.json({error:"Uma configuração fiscal desta empresa precisa ser revisada pelo escritório antes da emissão.",code:"FISCAL_CONFIGURATION_INCOMPLETE"},{status:422});
    const replay=await admin.from("invoices").select("id,status,access_key,nfse_number").eq("organization_id",session.organizationId).eq("idempotency_key",idempotencyKey).maybeSingle();
    if(replay.data) return NextResponse.json({invoiceId:replay.data.id,status:replay.data.status,accessKey:replay.data.access_key,nfseNumber:replay.data.nfse_number},{headers:{"X-Idempotent-Replay":"true","X-Request-ID":requestId}});
    const fiscal=await resolveFiscalConfiguration({municipalityCode:organization.municipality_code,nationalTaxCode:service.national_tax_code,municipalServiceCode:service.municipal_service_code,taxRegime:profile.tax_regime,reviewedAt:profile.reviewed_at,serviceDate:body.serviceDate,dpsConfiguration:profile.dps_configuration});
    const {data:dps,error:dpsError}=await admin.rpc("reserve_dps_number",{target_org:session.organizationId,target_env:"PRODUCTION_RESTRICTED",target_series:"00001"});
    if(dpsError||dps===null) throw new Error("DPS_RESERVATION_FAILED");
    const document = buildFiscalDocument({organization:{id:organization.id,taxId:organization.tax_id,municipalRegistration:organization.municipal_registration??"",municipalityCode:organization.municipality_code},customer:{taxId:customer.tax_id,legalName:customer.legal_name},service:{nationalTaxCode:service.national_tax_code,municipalServiceCode:fiscal.municipalServiceCode},taxConfiguration:{regime:profile.tax_regime,taxationType:"MUNICIPAL",iss:{withheld:fiscal.iss.withholdingType!=="1",source:fiscal.iss.source},ibsCbs:{customerFieldsEnabled:false}},amountCents:parseMoneyToCents(body.amount),serviceDate:body.serviceDate,description:body.description,dpsNumber:BigInt(dps),dpsSeries:"00001"});
    const {data:invoice,error:invoiceError}=await admin.from("invoices").insert({organization_id:session.organizationId,customer_id:customer.id,service_template_id:service.id,amount_cents:document.amountCents,service_date:body.serviceDate,description:body.description,status:"READY",idempotency_key:idempotencyKey,dps_series:"00001",dps_number:dps,dps_identifier:document.dps.identifier,environment:"PRODUCTION_RESTRICTED",created_by:session.userId}).select("id").single();
    if(invoiceError||!invoice) throw new Error("INVOICE_PERSIST_FAILED");
    const attemptRequestId=crypto.randomUUID();
    const {error:attemptError}=await admin.from("invoice_attempts").insert({invoice_id:invoice.id,organization_id:session.organizationId,request_id:attemptRequestId,status:"STARTED",environment:"PRODUCTION_RESTRICTED"});
    if(attemptError)throw new Error("INVOICE_ATTEMPT_PERSIST_FAILED");
    logEvent("info","INVOICE_REQUESTED",{ requestId, organizationId:session.organizationId, idempotencyKey });
    let result;
    try{result = await getNFSeProvider().issue({ document, idempotencyKey, scenario:body.scenario });}
    catch(error){const safe=error instanceof SafeFiscalError?error.safeMessage:"Não foi possível transmitir a nota.";const blocked=error instanceof SafeFiscalError&&error.code==="NFSE_NATIONAL_NOT_HOMOLOGATED";await Promise.all([admin.from("invoices").update({status:"READY"}).eq("id",invoice.id),admin.from("invoice_attempts").update({status:blocked?"TRANSMISSION_BLOCKED":"TRANSMISSION_FAILED",safe_error_message:safe,finished_at:new Date().toISOString()}).eq("request_id",attemptRequestId)]);throw error;}
    if (result.status === "REJECTED") { await Promise.all([admin.from("invoices").update({status:"REJECTED"}).eq("id",invoice.id),admin.from("invoice_attempts").update({status:"COMPLETED",finished_at:new Date().toISOString()}).eq("request_id",attemptRequestId)]); logEvent("warn","INVOICE_REJECTED",{requestId,code:result.code}); return NextResponse.json({ invoiceId:invoice.id,status:result.status, safeMessage:result.safeMessage },{ status:422, headers:{"X-Request-ID":requestId} }); }
    await Promise.all([admin.from("invoices").update(result.status==="ISSUED"?{status:"ISSUED",access_key:result.accessKey,nfse_number:result.nfseNumber,issued_at:new Date().toISOString()}:{status:"UNKNOWN"}).eq("id",invoice.id),admin.from("invoice_attempts").update({status:result.status==="UNKNOWN"?"UNKNOWN_AFTER_TRANSMISSION":"COMPLETED",finished_at:new Date().toISOString()}).eq("request_id",attemptRequestId)]);
    const payload = { ...result, invoiceId:invoice.id };
    logEvent("info",result.status === "ISSUED" ? "INVOICE_ISSUED" : "INVOICE_UNKNOWN",{requestId,status:result.status});
    return NextResponse.json(payload,{ status:result.status === "UNKNOWN" ? 202 : 201, headers:{"X-Request-ID":requestId} });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error:"Revise os dados informados.", fields:error.flatten().fieldErrors },{status:400,headers:{"X-Request-ID":requestId}});
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error:"Muitas tentativas. Aguarde um minuto e tente novamente." },{status:429,headers:{"X-Request-ID":requestId}});
    if(error instanceof SafeFiscalError)return NextResponse.json({error:error.safeMessage,code:error.code},{status:422,headers:{"X-Request-ID":requestId}});
    logEvent("error","INVOICE_REQUEST_FAILED",{requestId,error:error instanceof Error ? error.message : "unknown"});
    return NextResponse.json({ error:"Não foi possível concluir a emissão. Informe o código de atendimento ao escritório.", requestId },{status:500,headers:{"X-Request-ID":requestId}});
  }
}
