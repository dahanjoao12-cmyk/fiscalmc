import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { can } from "@/lib/security/authorization";
import { OrganizationCertificateProvider } from "@/lib/nfse/certificate/organization-provider";
import { signDpsXml,verifyDpsSignature } from "@/lib/nfse/dps/signature";
import { validateDpsXml } from "@/lib/nfse/dps/xsd";
import { MtlsHttpClient } from "@/lib/nfse/client/mtls-http-client";
import { MunicipalParametersProvider } from "@/lib/nfse/municipal-parameters/client";

export const runtime="nodejs";

/** Read-only operational preflight. It never creates a DPS, reserves a sequence, or transmits. */
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const session=await requireOfficeSession();
    if(!can(session.role,"certificate:read"))return NextResponse.json({error:"Acesso do escritório necessário."},{status:403});
    const{id}=await params;
    if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Empresa não encontrada."},{status:404});
    const provider=new OrganizationCertificateProvider();
    await provider.getCertificateMaterial({organizationId:id});
    const unsignedXml=await readFile(join(process.cwd(),"fixtures","dps","minimal-valid-unsigned.xml"),"utf8");
    const unsigned=await validateDpsXml(unsignedXml);
    if(!unsigned.valid)throw new Error("UNSIGNED_XSD_FAILED");
    const signedXml=await signDpsXml(unsignedXml,{certificateProvider:provider,organizationId:id});
    const signed=await validateDpsXml(signedXml);
    if(!signed.valid)throw new Error("SIGNED_XSD_FAILED");
    verifyDpsSignature(signedXml);
    const municipal=new MunicipalParametersProvider(new MtlsHttpClient(provider),undefined,id);
    await municipal.getConvention("3304557");
    return NextResponse.json({a1Decrypt:true,provider:true,unsignedXsd:true,signedXsd:true,xmldsig:true,signatureVerification:true,mtlsHandshake:true,municipalApi:true});
  }catch(error){
    const code=error instanceof Error&&"code" in error&&typeof error.code==="string"?error.code:error instanceof Error?error.message:"PREFLIGHT_FAILED";
    return NextResponse.json({error:"O preflight técnico não foi concluído.",code},{status:422});
  }
}
