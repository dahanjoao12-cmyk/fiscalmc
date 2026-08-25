import forge from "node-forge";
export type CertificateStatus="VALID"|"INVALID_PASSWORD"|"NOT_YET_VALID"|"EXPIRED"|"INVALID_FILE";
export type CertificateMetadata={subject:string;issuer:string;serial:string;validFrom:string;validUntil:string;ownerTaxId?:string};
export type CertificateValidation={status:CertificateStatus;metadata?:CertificateMetadata};

export function validateA1(buffer:Buffer,password:string,now=new Date()):CertificateValidation {
  try {
    const asn1=forge.asn1.fromDer(buffer.toString("binary"));
    const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,password);
    const bags=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]??[];
    const cert=bags[0]?.cert;
    if(!cert) return {status:"INVALID_FILE"};
    const subject=cert.subject.attributes.map((item)=>`${item.shortName}=${item.value}`).join(", ");
    const ownerTaxId=subject.match(/(?:CNPJ|2\.5\.4\.5|serialNumber)\s*=\s*([^,]+)/i)?.[1]?.replace(/\D/g,"");
    const metadata={subject,issuer:cert.issuer.attributes.map((item)=>`${item.shortName}=${item.value}`).join(", "),serial:cert.serialNumber,validFrom:cert.validity.notBefore.toISOString(),validUntil:cert.validity.notAfter.toISOString(),...(ownerTaxId?.length===14?{ownerTaxId}:{})};
    if(cert.validity.notBefore>now) return {status:"NOT_YET_VALID",metadata};
    if(cert.validity.notAfter<=now) return {status:"EXPIRED",metadata};
    return {status:"VALID",metadata};
  } catch(error) {
    const message=error instanceof Error?error.message:"";
    return {status:/password|mac|pkcs12/i.test(message) ? "INVALID_PASSWORD" : "INVALID_FILE"};
  }
}
export function parseA1(buffer:Buffer,password:string):CertificateMetadata { const result=validateA1(buffer,password); if(result.status!=="VALID"||!result.metadata) throw new Error(`A1_${result.status}`); return result.metadata; }
