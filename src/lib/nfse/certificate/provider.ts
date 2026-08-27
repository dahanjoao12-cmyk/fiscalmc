import "server-only";
import type { CertificateMetadata } from "./parse";

export type CertificateMaterial={cert:string;key:string;metadata:CertificateMetadata};

/** A server-only source of the same A1 material used by XMLDSIG and mTLS. */
export interface CertificateProvider{
  getCertificateMaterial(input:{organizationId?:string}):Promise<CertificateMaterial>;
}
