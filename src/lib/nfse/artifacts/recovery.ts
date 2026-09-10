import "server-only";
import { z } from "zod";
import { SefinRestrictedReconciliationClient } from "../reconciliation/client";
import type { NFSeEnvironment } from "../types";
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
  // The XML is already recovered at this point; a DANFSe failure (SEFIN still
  // generating it, a transient error) must not undo that or fail the whole call.
  let danfseAvailable=false;
  try{
    const danfse=await client.getDanfseByAccessKey({organizationId:input.organizationId,accessKey});
    if(danfse){
      const pdfArtifact=await persist({invoiceId:input.invoiceId,organizationId:input.organizationId,artifactType:"DANFSE_PDF",content:danfse.pdf,contentType:danfse.contentType});
      recoveredTypes.push(pdfArtifact.artifact_type as "DANFSE_PDF");
      danfseAvailable=true;
    }
  }catch{ /* best-effort; the XML recovery above still succeeds */ }
  return{accessKey:nfse.accessKey,nfseNumber:nfse.nfseNumber,...(nfse.issuedAt?{issuedAt:nfse.issuedAt}:{}),recoveredTypes,danfseAvailable};
}

/**
 * Used by the artifact download route so "Baixar PDF/XML" recovers on demand
 * instead of requiring a separate manual step. Never throws: the caller falls
 * back to whatever is already available (or a 404) when this can't help.
 */
export async function ensureArtifactsRecoveredBestEffort(input:{invoiceId:string;organizationId:string;accessKey:string|null;environment:NFSeEnvironment|null}):Promise<{ok:true}|{ok:false;debug:string}>{
  if(!input.accessKey)return{ok:false,debug:"NO_ACCESS_KEY"};
  try{
    await recoverIssuedInvoiceArtifacts({invoiceId:input.invoiceId,organizationId:input.organizationId,accessKey:input.accessKey,client:new SefinRestrictedReconciliationClient(undefined,input.environment??"PRODUCTION_RESTRICTED")});
    return{ok:true};
  }catch(error){
    return{ok:false,debug:error instanceof Error?`${error.name}: ${error.message}`:String(error)};
  }
}
