import type { CertificateMetadata } from "./parse";

export const CERTIFICATE_EXPIRING_SOON_DAYS=30;
export type StoredCertificateStatus="VALID"|"EXPIRING"|"EXPIRED"|"INVALID"|"REVOKED";
export type CertificateReadiness={ready:boolean;warning:boolean;status:StoredCertificateStatus|"MISSING"|"MISMATCH";message:string;daysUntilExpiry?:number};

export function normalizeTaxId(value:string|undefined|null){return value?.replace(/\D/g,"")??"";}

export function classifyCertificate(metadata:CertificateMetadata,now=new Date()):"VALID"|"EXPIRING"|"EXPIRED"{
  const remaining=Math.floor((new Date(metadata.validUntil).getTime()-now.getTime())/86_400_000);
  if(remaining<0)return "EXPIRED";
  return remaining<=CERTIFICATE_EXPIRING_SOON_DAYS?"EXPIRING":"VALID";
}

export function getCertificateReadiness(input:{certificate?:{status:StoredCertificateStatus;owner_tax_id:string|null;valid_until:string}|null;organizationTaxId:string;now?:Date}):CertificateReadiness{
  const certificate=input.certificate;
  if(!certificate)return{ready:false,warning:false,status:"MISSING",message:"Certificado não cadastrado"};
  if(normalizeTaxId(certificate.owner_tax_id)!==normalizeTaxId(input.organizationTaxId))return{ready:false,warning:false,status:"MISMATCH",message:"O certificado não corresponde ao CNPJ da empresa."};
  const days=Math.floor((new Date(certificate.valid_until).getTime()-(input.now??new Date()).getTime())/86_400_000);
  if(certificate.status==="INVALID"||certificate.status==="REVOKED")return{ready:false,warning:false,status:certificate.status,message:"Certificado inválido."};
  if(certificate.status==="EXPIRED"||days<0)return{ready:false,warning:false,status:"EXPIRED",message:"Certificado expirado."};
  if(certificate.status==="EXPIRING"||days<=CERTIFICATE_EXPIRING_SOON_DAYS)return{ready:true,warning:true,status:"EXPIRING",daysUntilExpiry:days,message:`Certificado vence em ${Math.max(days,0)} dias.`};
  return{ready:true,warning:false,status:"VALID",daysUntilExpiry:days,message:"Certificado válido"};
}
