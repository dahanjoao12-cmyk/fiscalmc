import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { can } from "@/lib/security/authorization";
import { OrganizationCertificateProvider } from "@/lib/nfse/certificate/organization-provider";

export const runtime="nodejs";

/** Read-only operational preflight. It never creates a DPS, reserves a sequence, or transmits. */
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  let stage="CERT_ACTIVE_LOOKUP";
  try{
    const session=await requireOfficeSession();
    if(!can(session.role,"certificate:read"))return NextResponse.json({error:"Acesso do escritório necessário."},{status:403});
    const{id}=await params;
    if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Empresa não encontrada."},{status:404});
    const provider=new OrganizationCertificateProvider();
    stage="CERTIFICATE_PROVIDER";
    await provider.getCertificateMaterial({organizationId:id});
    stage="UNSIGNED_XSD";
    let unsignedXml:string;
    try{unsignedXml=await readFile(join(process.cwd(),"fixtures","dps","minimal-valid-unsigned.xml"),"utf8");}
    catch{throw Object.assign(new Error("Fixture DPS indisponível."),{code:"FIXTURE_READ_FAILED"});}
    console.info("CERTIFICATE_PREFLIGHT_UNSIGNED_XSD",{substage:"FIXTURE_READ"});
    let validateDpsXml:typeof import("@/lib/nfse/dps/xsd").validateDpsXml,listDpsSchemaFiles:typeof import("@/lib/nfse/dps/xsd").listDpsSchemaFiles,validateXsdRuntimeProbe:typeof import("@/lib/nfse/dps/xsd").validateXsdRuntimeProbe;
    try{({validateDpsXml,listDpsSchemaFiles,validateXsdRuntimeProbe}=await import("@/lib/nfse/dps/xsd"));}
    catch{throw Object.assign(new Error("Validador XSD indisponível."),{code:"XSD_RUNTIME_UNAVAILABLE"});}
    const schemaFiles=await listDpsSchemaFiles();
    console.info("CERTIFICATE_PREFLIGHT_UNSIGNED_XSD",{substage:"SCHEMA_DIRECTORY_READ",schemaFiles});
    await validateXsdRuntimeProbe();
    console.info("CERTIFICATE_PREFLIGHT_UNSIGNED_XSD",{substage:"WASM_MINIMAL_VALIDATE",valid:true});
    const unsigned=await validateDpsXml(unsignedXml);
    console.info("CERTIFICATE_PREFLIGHT_UNSIGNED_XSD",{substage:"SCHEMA_PRELOAD",schemaFiles});
    console.info("CERTIFICATE_PREFLIGHT_UNSIGNED_XSD",{substage:"WASM_VALIDATE",valid:unsigned.valid,errorCount:unsigned.errors.length,errors:unsigned.errors.slice(0,3),schemaFiles});
    if(!unsigned.valid)throw Object.assign(new Error("A fixture DPS não passou no XSD."),{code:"UNSIGNED_XSD_FAILED"});
    stage="XMLDSIG";
    let signDpsXml:typeof import("@/lib/nfse/dps/signature").signDpsXml,verifyDpsSignature:typeof import("@/lib/nfse/dps/signature").verifyDpsSignature;
    try{({signDpsXml,verifyDpsSignature}=await import("@/lib/nfse/dps/signature"));}
    catch{throw Object.assign(new Error("Biblioteca XMLDSIG indisponível."),{code:"XMLDSIG_RUNTIME_UNAVAILABLE"});}
    const signedXml=await signDpsXml(unsignedXml,{certificateProvider:provider,organizationId:id});
    const signed=await validateDpsXml(signedXml);
    if(!signed.valid)throw new Error("SIGNED_XSD_FAILED");
    stage="SIGNATURE_VERIFICATION";
    verifyDpsSignature(signedXml);
    stage="MTLS";
    let MtlsHttpClient:typeof import("@/lib/nfse/client/mtls-http-client").MtlsHttpClient,MunicipalParametersProvider:typeof import("@/lib/nfse/municipal-parameters/client").MunicipalParametersProvider;
    try{({MtlsHttpClient}=await import("@/lib/nfse/client/mtls-http-client"));({MunicipalParametersProvider}=await import("@/lib/nfse/municipal-parameters/client"));}
    catch{throw Object.assign(new Error("Cliente mTLS indisponível."),{code:"MTLS_RUNTIME_UNAVAILABLE"});}
    const municipal=new MunicipalParametersProvider(new MtlsHttpClient(provider),undefined,id);
    await municipal.getConvention("3304557");
    return NextResponse.json({a1Decrypt:true,provider:true,unsignedXsd:true,signedXsd:true,xmldsig:true,signatureVerification:true,mtlsHandshake:true,municipalApi:true});
  }catch(error){
    const upstream=error instanceof Error&&"code" in error&&typeof error.code==="string"?error.code:"PREFLIGHT_FAILED";
    const code=`${stage}:${upstream}`;
    const diagnostic=error instanceof Error&&"diagnostic" in error&&typeof error.diagnostic==="object"&&error.diagnostic?error.diagnostic:undefined;
    console.error("CERTIFICATE_PREFLIGHT_FAILURE",{stage,code:upstream,diagnostic});
    return NextResponse.json({error:"O preflight técnico não foi concluído.",code},{status:422});
  }
}
