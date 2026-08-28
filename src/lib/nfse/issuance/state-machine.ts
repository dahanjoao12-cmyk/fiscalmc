import type { InvoiceStatus,IssueResult } from "../types";
import { MtlsRequestError } from "../client/mtls-http-client";
import { SafeFiscalError } from "../errors";

export const UNKNOWN_CLIENT_MESSAGE="Estamos confirmando a situação desta nota.";

export type ReplayDecision="CLAIM"|"RETURN_FINAL"|"RECONCILE"|"IN_PROGRESS"|"BLOCKED";

export function decideIdempotencyReplay(status:InvoiceStatus):ReplayDecision{
  if(status==="READY")return "CLAIM";
  if(status==="ISSUED"||status==="REJECTED")return "RETURN_FINAL";
  if(status==="UNKNOWN")return "RECONCILE";
  if(status==="SUBMITTING")return "IN_PROGRESS";
  return "BLOCKED";
}

export type SubmissionFinalization=
  |{outcome:"ISSUED";attemptStatus:"COMPLETED";bytesMayHaveBeenSent:true;confirmedNoEmission:false;result:Extract<IssueResult,{status:"ISSUED"}>}
  |{outcome:"REJECTED";attemptStatus:"COMPLETED";bytesMayHaveBeenSent:true;confirmedNoEmission:true;result:Extract<IssueResult,{status:"REJECTED"}>}
  |{outcome:"UNKNOWN";attemptStatus:"UNKNOWN_AFTER_TRANSMISSION";bytesMayHaveBeenSent:true;confirmedNoEmission:false;result:Extract<IssueResult,{status:"UNKNOWN"}>}
  |{outcome:"READY";attemptStatus:"TRANSMISSION_FAILED"|"TRANSMISSION_BLOCKED"|"BUILD_FAILED"|"SIGNATURE_FAILED";bytesMayHaveBeenSent:boolean;confirmedNoEmission:boolean;safeMessage:string;error:unknown};

export function finalizationFromResult(result:IssueResult):SubmissionFinalization{
  if(result.status==="ISSUED")return{outcome:"ISSUED",attemptStatus:"COMPLETED",bytesMayHaveBeenSent:true,confirmedNoEmission:false,result};
  if(result.status==="REJECTED")return{outcome:"REJECTED",attemptStatus:"COMPLETED",bytesMayHaveBeenSent:true,confirmedNoEmission:true,result};
  return{outcome:"UNKNOWN",attemptStatus:"UNKNOWN_AFTER_TRANSMISSION",bytesMayHaveBeenSent:true,confirmedNoEmission:false,result:{...result,safeMessage:UNKNOWN_CLIENT_MESSAGE}};
}

export function finalizationFromError(error:unknown):SubmissionFinalization{
  if(error instanceof MtlsRequestError&&error.delivery==="POSSIBLY_SENT")return{outcome:"UNKNOWN",attemptStatus:"UNKNOWN_AFTER_TRANSMISSION",bytesMayHaveBeenSent:true,confirmedNoEmission:false,result:{status:"UNKNOWN",dpsIdentifier:"",safeMessage:UNKNOWN_CLIENT_MESSAGE}};
  if(error instanceof SafeFiscalError){
    const attemptStatus=error.code==="RESTRICTED_TRANSMISSION_NOT_AUTHORIZED"||error.code==="NFSE_NATIONAL_NOT_HOMOLOGATED"?"TRANSMISSION_BLOCKED":error.code==="SIGNATURE_FAILED"?"SIGNATURE_FAILED":error.code==="SEFIN_CONFIRMED_NO_EMISSION"?"TRANSMISSION_FAILED":"BUILD_FAILED";
    const confirmedNoEmission=error.code==="SEFIN_CONFIRMED_NO_EMISSION";
    return{outcome:"READY",attemptStatus,bytesMayHaveBeenSent:confirmedNoEmission,confirmedNoEmission,safeMessage:error.safeMessage,error};
  }
  return{outcome:"READY",attemptStatus:"TRANSMISSION_FAILED",bytesMayHaveBeenSent:false,confirmedNoEmission:false,safeMessage:"Não foi possível iniciar a transmissão da nota.",error};
}
