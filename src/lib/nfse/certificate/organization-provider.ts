import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "./encryption";
import { loadA1Material } from "./parse";
import type { CertificateProvider } from "./provider";
import { classifyCertificate,normalizeTaxId } from "./status";

const envelopeSchema=z.object({version:z.literal(1),iv:z.string().min(1),tag:z.string().min(1),ciphertext:z.string().min(1)});

/**
 * Multi-tenant A1 source. It intentionally has no fallback to the local
 * certificate: production callers must provide a current organization record.
 */
export class OrganizationCertificateProvider implements CertificateProvider{
  async getCertificateMaterial(input:{organizationId?:string}){
    if(!input.organizationId)throw Object.assign(new Error("Organização do certificado não informada."),{code:"CERTIFICATE_LOAD_FAILED"});
    const db=createAdminClient();
    const[{data:organization},{data:certificate}]=await Promise.all([
      db.from("organizations").select("tax_id").eq("id",input.organizationId).maybeSingle(),
      db.from("digital_certificates").select("id,organization_id,private_storage_path,encrypted_password,status,owner_tax_id,valid_until,fingerprint_sha256").eq("organization_id",input.organizationId).is("replaced_at",null).maybeSingle(),
    ]);
    if(!organization||!certificate)throw Object.assign(new Error("Certificado da organização não encontrado."),{code:"CERTIFICATE_LOAD_FAILED"});
    if(normalizeTaxId(certificate.owner_tax_id)!==normalizeTaxId(organization.tax_id))throw Object.assign(new Error("Certificado não corresponde ao CNPJ da organização."),{code:"CERTIFICATE_ORGANIZATION_MISMATCH"});
    if(!["VALID","EXPIRING"].includes(certificate.status)||new Date(certificate.valid_until)<=new Date())throw Object.assign(new Error("Certificado A1 não está apto."),{code:"CERTIFICATE_EXPIRED"});
    const{data:file,error:fileError}=await db.storage.from("a1-certificates").download(certificate.private_storage_path);
    if(fileError||!file)throw Object.assign(new Error("Não foi possível carregar o certificado."),{code:"CERTIFICATE_LOAD_FAILED"});
    let password:Buffer;
    try{password=decryptSecret(envelopeSchema.parse(certificate.encrypted_password));}catch{throw Object.assign(new Error("Não foi possível abrir as credenciais do certificado."),{code:"CERTIFICATE_LOAD_FAILED"});}
    const material=loadA1Material(Buffer.from(await file.arrayBuffer()),password.toString("utf8"));
    if(normalizeTaxId(material.metadata.ownerTaxId)!==normalizeTaxId(organization.tax_id))throw Object.assign(new Error("Certificado não corresponde ao CNPJ da organização."),{code:"CERTIFICATE_ORGANIZATION_MISMATCH"});
    if(material.metadata.fingerprintSha256!==certificate.fingerprint_sha256)throw Object.assign(new Error("Fingerprint do certificado inválido."),{code:"CERTIFICATE_LOAD_FAILED"});
    const currentStatus=classifyCertificate(material.metadata);
    if(currentStatus==="EXPIRED")throw Object.assign(new Error("Certificado expirado."),{code:"CERTIFICATE_EXPIRED"});
    return material;
  }
}
