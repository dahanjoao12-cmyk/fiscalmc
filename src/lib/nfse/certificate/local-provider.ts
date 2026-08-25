import { readFile } from "node:fs/promises";
import forge from "node-forge";
import { validateA1 } from "./parse";

/** Local-only source for smoke tests. Never writes certificate material to the repository. */
export class LocalCertificateProvider {
  private async load(){const path=process.env.NFSE_CERT_PATH;const password=process.env.NFSE_CERT_PASSWORD;if(!path||!password)throw Object.assign(new Error("Certificado local não configurado."),{code:"CERTIFICATE_LOAD_FAILED"});return{buffer:await readFile(path),password};}
  async validate() {
    const {buffer,password}=await this.load(); return validateA1(buffer,password);
  }
  async loadMtlsMaterial(){const {buffer,password}=await this.load();const validation=validateA1(buffer,password);if(validation.status!=="VALID")throw Object.assign(new Error("Certificado A1 inválido."),{code:validation.status==="INVALID_PASSWORD"?"INVALID_CERTIFICATE_PASSWORD":validation.status==="EXPIRED"?"CERTIFICATE_EXPIRED":"CERTIFICATE_LOAD_FAILED"});try{const asn1=forge.asn1.fromDer(buffer.toString("binary"));const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,password);const certBag=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]??[];const keyBag=(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]??p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]??[])[0];const cert=certBag[0]?.cert;if(!cert||!keyBag?.key)throw new Error("Material PKCS#12 incompleto.");return{cert:forge.pki.certificateToPem(cert),key:forge.pki.privateKeyToPem(keyBag.key),metadata:validation.metadata};}catch{throw Object.assign(new Error("Não foi possível extrair material mTLS."),{code:"CERTIFICATE_LOAD_FAILED"});}}
}
