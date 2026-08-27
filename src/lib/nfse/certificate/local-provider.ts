import { readFile } from "node:fs/promises";
import { loadA1Material,validateA1 } from "./parse";
import type { CertificateProvider } from "./provider";

/** Local-only source for development and explicit smoke tests. Never writes material to the repository. */
export class LocalCertificateProvider implements CertificateProvider{
  private async load(){const path=process.env.NFSE_CERT_PATH;const password=process.env.NFSE_CERT_PASSWORD;if(!path||!password)throw Object.assign(new Error("Certificado local não configurado."),{code:"CERTIFICATE_LOAD_FAILED"});return{buffer:await readFile(path),password};}
  async validate(){const {buffer,password}=await this.load();return validateA1(buffer,password);}
  async getCertificateMaterial(input:{organizationId?:string}={}){void input;const {buffer,password}=await this.load();return loadA1Material(buffer,password);}
  /** @deprecated Use getCertificateMaterial so XMLDSIG and mTLS share the same provider contract. */
  async loadMtlsMaterial(){return this.getCertificateMaterial({});}
}
