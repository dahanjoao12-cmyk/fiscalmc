import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceStatus,IssueResult,NFSeEnvironment } from "../types";
import { decideIdempotencyReplay,finalizationFromError,finalizationFromResult,type SubmissionFinalization } from "./state-machine";

export type SubmissionClaim={claimed:boolean;currentStatus:InvoiceStatus};
export interface InvoiceSubmissionGateway{
  claim(input:{invoiceId:string;organizationId:string;requestId:string}):Promise<SubmissionClaim>;
  finalize(input:{invoiceId:string;organizationId:string;requestId:string;finalization:SubmissionFinalization;dpsIdentifier:string}):Promise<InvoiceStatus>;
}

export type SafeSubmissionResult=
  |{kind:"RESULT";result:IssueResult}
  |{kind:"REPLAY";status:InvoiceStatus;decision:ReturnType<typeof decideIdempotencyReplay>};

export async function submitInvoiceSafely(input:{gateway:InvoiceSubmissionGateway;invoiceId:string;organizationId:string;requestId:string;dpsIdentifier:string;execute:()=>Promise<IssueResult>}):Promise<SafeSubmissionResult>{
  const claim=await input.gateway.claim(input);
  if(!claim.claimed)return{kind:"REPLAY",status:claim.currentStatus,decision:decideIdempotencyReplay(claim.currentStatus)};
  try{
    const result=await input.execute();
    const finalization=finalizationFromResult(result);
    await input.gateway.finalize({...input,finalization});
    return{kind:"RESULT",result:finalization.outcome==="UNKNOWN"?finalization.result:result};
  }catch(error){
    const finalization=finalizationFromError(error);
    if(finalization.outcome==="UNKNOWN"&&finalization.result.dpsIdentifier==="")finalization.result.dpsIdentifier=input.dpsIdentifier;
    await input.gateway.finalize({...input,finalization});
    if(finalization.outcome==="UNKNOWN")return{kind:"RESULT",result:finalization.result};
    throw error;
  }
}

const claimRowSchema=z.object({claimed:z.boolean(),current_status:z.enum(["DRAFT","READY","SUBMITTING","ISSUED","REJECTED","UNKNOWN","CANCELLED"])});

export function createSupabaseInvoiceSubmissionGateway(environment:NFSeEnvironment="PRODUCTION_RESTRICTED"):InvoiceSubmissionGateway{
  const db=createAdminClient();
  return{
    async claim(input){
      const{data,error}=await db.rpc("claim_invoice_submission",{p_invoice_id:input.invoiceId,p_organization_id:input.organizationId,p_request_id:input.requestId,p_environment:environment});
      if(error)throw new Error("INVOICE_SUBMISSION_CLAIM_FAILED");
      const row=claimRowSchema.parse(Array.isArray(data)?data[0]:data);
      return{claimed:row.claimed,currentStatus:row.current_status};
    },
    async finalize(input){
      const f=input.finalization;
      const result=f.outcome==="ISSUED"?f.result:undefined;
      const rejection=f.outcome==="REJECTED"?f.result:undefined;
      const unknown=f.outcome==="UNKNOWN"?f.result:undefined;
      const safeMessage=f.outcome==="READY"?f.safeMessage:rejection?.safeMessage??unknown?.safeMessage??null;
      const{data,error}=await db.rpc("finalize_invoice_submission",{
        p_invoice_id:input.invoiceId,p_organization_id:input.organizationId,p_request_id:input.requestId,
        p_outcome:f.outcome,p_attempt_status:f.attemptStatus,p_bytes_may_have_been_sent:f.bytesMayHaveBeenSent,p_confirmed_no_emission:f.confirmedNoEmission,
        p_access_key:result?.accessKey??null,p_nfse_number:result?.nfseNumber??null,p_issued_at:result?new Date().toISOString():null,
        p_rejection_code:rejection?.code??null,p_safe_message:safeMessage,p_response_metadata:{dpsIdentifier:input.dpsIdentifier},
      });
      if(error)throw new Error("INVOICE_SUBMISSION_FINALIZE_FAILED");
      return z.enum(["DRAFT","READY","SUBMITTING","ISSUED","REJECTED","UNKNOWN","CANCELLED"]).parse(data);
    }
  };
}
