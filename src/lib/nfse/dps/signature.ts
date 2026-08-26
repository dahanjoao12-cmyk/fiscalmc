import { SignedXml } from "xml-crypto";
import { LocalCertificateProvider } from "../certificate/local-provider";
import { SafeFiscalError } from "../errors";

const xmlDsigNamespace="http://www.w3.org/2000/09/xmldsig#";
// The current official OpenAPI requires XMLDSIG but does not publish a narrower
// algorithm profile. RSA-SHA256/exclusive C14N is isolated here for controlled
// local verification; transmission remains blocked until official acceptance.
const profile={signatureAlgorithm:"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",canonicalizationAlgorithm:"http://www.w3.org/2001/10/xml-exc-c14n#",digestAlgorithm:"http://www.w3.org/2001/04/xmlenc#sha256",transforms:["http://www.w3.org/2000/09/xmldsig#enveloped-signature","http://www.w3.org/2001/10/xml-exc-c14n#"]} as const;

export async function signDpsXml(unsignedXml:string){
  try{
    const material=await new LocalCertificateProvider().loadMtlsMaterial();
    const signature=new SignedXml({privateKey:material.key,publicCert:material.cert,getKeyInfoContent:SignedXml.getKeyInfoContent});
    signature.signatureAlgorithm=profile.signatureAlgorithm;
    signature.canonicalizationAlgorithm=profile.canonicalizationAlgorithm;
    signature.addReference({xpath:"//*[local-name(.)='infDPS' and namespace-uri(.)='http://www.sped.fazenda.gov.br/nfse']",transforms:[...profile.transforms],digestAlgorithm:profile.digestAlgorithm,uri:""});
    signature.computeSignature(unsignedXml,{location:{reference:"/*[local-name(.)='DPS']/*[local-name(.)='infDPS']",action:"after"}});
    return signature.getSignedXml();
  }catch(error){
    if(error instanceof SafeFiscalError)throw error;
    throw new SafeFiscalError("SIGNATURE_FAILED","Não foi possível assinar a DPS.");
  }
}

export function verifyDpsSignature(signedXml:string){
  const match=signedXml.match(/<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#"[\s\S]*?<\/Signature>/);
  if(!match)throw new SafeFiscalError("SIGNATURE_FAILED","A DPS não contém assinatura XMLDSIG.");
  const verifier=new SignedXml({getCertFromKeyInfo:SignedXml.getCertFromKeyInfo});
  verifier.loadSignature(match[0]);
  if(!verifier.checkSignature(signedXml)||verifier.getSignedReferences().length!==1)throw new SafeFiscalError("SIGNATURE_FAILED","A verificação criptográfica da assinatura da DPS falhou.");
  return true;
}

export const XMLDSIG_NAMESPACE=xmlDsigNamespace;
