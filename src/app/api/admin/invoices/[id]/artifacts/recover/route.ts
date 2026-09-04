import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIssuanceContext, requireOfficeSession } from "@/lib/auth/session";
import { recoverIssuedInvoiceArtifacts } from "@/lib/nfse/artifacts/recovery";
import { SafeFiscalError } from "@/lib/nfse/errors";
import { can } from "@/lib/security/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Recovers documents through official GET endpoints only; it cannot emit a DPS. */
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=crypto.randomUUID();
  try{
    const office=await requireOfficeSession();
    if(!can(office.role,"invoice:read"))return NextResponse.json({error:"Acesso negado."},{status:403});
    const{id}=await context.params;
    if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Nota não encontrada."},{status:404});
    const db=createAdminClient();
    const{data:invoice}=await db.from("invoices").select("id,organization_id,status,access_key,nfse_number,issued_at").eq("id",id).maybeSingle();
    if(!invoice)return NextResponse.json({error:"Nota não encontrada."},{status:404});
    const actor=await requireIssuanceContext(invoice.organization_id);
    if(actor.actorType!=="OFFICE")return NextResponse.json({error:"Acesso do escritório necessário."},{status:403});
    if(invoice.status!=="ISSUED"||!invoice.access_key)return NextResponse.json({error:"Esta NFS-e ainda não possui documento oficial disponível para recuperação."},{status:422});

    const recovered=await recoverIssuedInvoiceArtifacts({invoiceId:invoice.id,organizationId:invoice.organization_id,accessKey:invoice.access_key});
    const{error:updateError}=await db.from("invoices").update({nfse_number:recovered.nfseNumber,issued_at:recovered.issuedAt??invoice.issued_at??new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",invoice.id).eq("organization_id",invoice.organization_id).eq("status","ISSUED");
    if(updateError)throw new Error("INVOICE_ARTIFACT_METADATA_PERSIST_FAILED");
    const{error:auditError}=await db.from("audit_logs").insert({actor_user_id:actor.actorUserId,actor_type:"OFFICE",organization_id:invoice.organization_id,action:"nfse_artifacts_recovered",entity:"invoice",entity_id:invoice.id,request_id:requestId,safe_metadata:{artifactTypes:recovered.recoveredTypes,danfseAvailable:recovered.danfseAvailable}});
    if(auditError)throw new Error("ARTIFACT_RECOVERY_AUDIT_FAILED");
    return NextResponse.json({nfseNumber:recovered.nfseNumber,artifactTypes:recovered.recoveredTypes,danfseAvailable:recovered.danfseAvailable,transmissionAttempted:false,sequenceConsumed:false});
  }catch(error){
    if(error instanceof SafeFiscalError)return NextResponse.json({error:error.safeMessage,code:error.code},{status:error.retryable?503:422});
    return NextResponse.json({error:"Não foi possível recuperar os documentos oficiais agora."},{status:500});
  }
}
