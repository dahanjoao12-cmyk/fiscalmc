import "server-only";
import { z } from "zod";
import { SefinRestrictedReconciliationClient } from "../reconciliation/client";
import { persistOfficialArtifact } from "./persistence";

const accessKeySchema=z.string().regex(/^\d{50}$/);

export type ArtifactRecoveryResult={
  accessKey:string;
  nfseNumber:string;
  issuedAt?:string;
  recoveredTypes:Array<"NFSE_XML"|"DANFSE_PDF">;
  danfseAvailable:boolean;
};
type ArtifactWriter=typeof persistOfficialArtifact;

/**
 * Recovers an already-issued document through official GET endpoints only.
 * It never reserves a DPS, changes transmission state, or invokes POST /nfse.
 */
export async function recoverIssuedInvoiceArtifacts(input:{invoiceId:string;organizationId:string;accessKey:string;client?:SefinRestrictedReconciliationClient;persist?:ArtifactWriter}):Promise<ArtifactRecoveryResult>{
  const accessKey=accessKeySchema.parse(input.accessKey);
  const client=input.client??new SefinRestrictedReconciliationClient();
  const persist=input.persist??persistOfficialArtifact;
  const nfse=await client.getNfseByAccessKey({organizationId:input.organizationId,accessKey});
  if(!nfse)throw new Error("OFFICIAL_NFSE_NOT_FOUND");
  const xmlArtifact=await persist({invoiceId:input.invoiceId,organizationId:input.organizationId,artifactType:"NFSE_XML",content:Buffer.from(nfse.xml,"utf8"),contentType:"application/xml"});
  const recoveredTypes:Array<"NFSE_XML"|"DANFSE_PDF">=[xmlArtifact.artifact_type as "NFSE_XML"];
  const danfse=await client.getDanfseByAccessKey({organizationId:input.organizationId,accessKey});
  if(danfse){
    const pdfArtifact=await persist({invoiceId:input.invoiceId,organizationId:input.organizationId,artifactType:"DANFSE_PDF",content:danfse.pdf,contentType:danfse.contentType});
    recoveredTypes.push(pdfArtifact.artifact_type as "DANFSE_PDF");
  }
  return{accessKey:nfse.accessKey,nfseNumber:nfse.nfseNumber,...(nfse.issuedAt?{issuedAt:nfse.issuedAt}:{}),recoveredTypes,danfseAvailable:Boolean(danfse)};
}
