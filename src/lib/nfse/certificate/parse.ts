import { createHash } from "node:crypto";
import forge from "node-forge";
import type { CertificateMaterial } from "./provider";

export type CertificateStatus="VALID"|"INVALID_PASSWORD"|"NOT_YET_VALID"|"EXPIRED"|"INVALID_FILE";
export type CertificateMetadata={subject:string;issuer:string;serial:string;validFrom:string;validUntil:string;ownerTaxId?:string;fingerprintSha256:string};
export type CertificateValidation={status:CertificateStatus;metadata?:CertificateMetadata};

function attributeText(attributes:forge.pki.CertificateField[]){return attributes.map(item=>`${item.shortName??item.name??item.type}=${item.value}`).join(", ");}
function normalizedTaxId(value:unknown){const normalized=String(value??"").replace(/\D/g,"");return normalized.length===14?normalized:undefined;}
function extractOwnerTaxId(attributes:forge.pki.CertificateField[]){
  for(const attribute of attributes){
    const identifier=`${attribute.name??""} ${attribute.shortName??""} ${attribute.type??""}`.toLowerCase();
    if(identifier.includes("serialnumber")||identifier.includes("2.5.4.5")||identifier.includes("cnpj")){
      const taxId=normalizedTaxId(attribute.value);
      if(taxId)return taxId;
    }
  }
  // ICP-Brasil PJ certificates commonly carry the holder CNPJ as the final
  // `:<14 digits>` segment of CN. This reads the distinguished-name value,
  // never infers an identifier from the company name.
  for(const attribute of attributes){
    const identifier=`${attribute.name??""} ${attribute.shortName??""}`.toLowerCase();
    const match=identifier.includes("commonname")?String(attribute.value??"").match(/(?:^|:)(\d{14})$/):null;
    if(match)return match[1];
  }
  const candidates=[...new Set(attributes.map(attribute=>normalizedTaxId(attribute.value)).filter((value):value is string=>Boolean(value)))];
  if(candidates.length===1)return candidates[0];
  return undefined;
}
function metadataFor(cert:forge.pki.Certificate):CertificateMetadata{
  const der=forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const ownerTaxId=extractOwnerTaxId(cert.subject.attributes);
  return {
    subject:attributeText(cert.subject.attributes),issuer:attributeText(cert.issuer.attributes),serial:cert.serialNumber,
    validFrom:cert.validity.notBefore.toISOString(),validUntil:cert.validity.notAfter.toISOString(),
    fingerprintSha256:createHash("sha256").update(Buffer.from(der,"binary")).digest("hex").toUpperCase(),
    ...(ownerTaxId?{ownerTaxId}:{}),
  };
}
function readP12(buffer:Buffer,password:string){
  const asn1=forge.asn1.fromDer(buffer.toString("binary"));
  return forge.pkcs12.pkcs12FromAsn1(asn1,false,password);
}
function materialFromP12(p12:forge.pkcs12.Pkcs12Pfx,metadata:CertificateMetadata):CertificateMaterial{
  const certBag=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]??[];
  const keyBag=(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]??p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]??[])[0];
  const cert=certBag[0]?.cert;
  if(!cert||!keyBag?.key)throw new Error("PKCS12_MATERIAL_INCOMPLETE");
  return{cert:forge.pki.certificateToPem(cert),key:forge.pki.privateKeyToPem(keyBag.key),metadata};
}

export function validateA1(buffer:Buffer,password:string,now=new Date()):CertificateValidation {
  try {
    const p12=readP12(buffer,password);
    const cert=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]?.[0]?.cert;
    if(!cert)return {status:"INVALID_FILE"};
    const metadata=metadataFor(cert);
    if(cert.validity.notBefore>now)return {status:"NOT_YET_VALID",metadata};
    if(cert.validity.notAfter<=now)return {status:"EXPIRED",metadata};
    return {status:"VALID",metadata};
  } catch(error) {
    const message=error instanceof Error?error.message:"";
    return {status:/password|mac|pkcs12/i.test(message) ? "INVALID_PASSWORD" : "INVALID_FILE"};
  }
}

export function loadA1Material(buffer:Buffer,password:string,now=new Date()):CertificateMaterial{
  const validation=validateA1(buffer,password,now);
  if(validation.status!=="VALID"||!validation.metadata)throw Object.assign(new Error("Certificado A1 inválido."),{code:validation.status==="INVALID_PASSWORD"?"INVALID_CERTIFICATE_PASSWORD":validation.status==="EXPIRED"?"CERTIFICATE_EXPIRED":"CERTIFICATE_LOAD_FAILED"});
  try{return materialFromP12(readP12(buffer,password),validation.metadata);}catch{throw Object.assign(new Error("Não foi possível extrair o material do certificado."),{code:"CERTIFICATE_LOAD_FAILED"});}
}

export function parseA1(buffer:Buffer,password:string):CertificateMetadata { const result=validateA1(buffer,password); if(result.status!=="VALID"||!result.metadata) throw new Error(`A1_${result.status}`); return result.metadata; }
