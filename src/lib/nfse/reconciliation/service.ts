import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceStatus } from "../types";
import { SefinRestrictedReconciliationClient,type OfficialReconciliationResult,type UnknownInvoiceLookup } from "./client";

export interface ReconciliationGateway{
  getInvoice(input:{invoiceId:string;organizationId:string}):Promise<{status:InvoiceStatus;dpsIdentifier:string}|null>;
  record(input:{invoiceId:string;organizationId:string;result:OfficialReconciliationResult}):Promise<InvoiceStatus>;
}

export async function reconcileUnknownInvoice(input:{invoiceId:string;organizationId:string;lookup?:UnknownInvoiceLookup;gateway?:ReconciliationGateway}){
  const gateway=input.gateway??createSupabaseReconciliationGateway();
  const invoice=await gateway.getInvoice(input);
  if(!invoice)throw new Error("INVOICE_NOT_FOUND");
  if(invoice.status!=="UNKNOWN")return{status:invoice.status,reconciled:false as const};
  const result=await (input.lookup??new SefinRestrictedReconciliationClient()).findByDps({organizationId:input.organizationId,dpsIdentifier:invoice.dpsIdentifier});
  const status=await gateway.record({...input,result});
  return{status,reconciled:true as const};
}

const invoiceStatusSchema=z.enum(["DRAFT","READY","SUBMITTING","ISSUED","REJECTED","UNKNOWN","CANCELLED"]);
export function createSupabaseReconciliationGateway():ReconciliationGateway{
  const db=createAdminClient();
  return{
    async getInvoice(input){
      const{data,error}=await db.from("invoices").select("status,dps_identifier").eq("id",input.invoiceId).eq("organization_id",input.organizationId).maybeSingle();
      if(error)throw new Error("INVOICE_LOOKUP_FAILED");
      if(!data)return null;
      if(!data.dps_identifier)throw new Error("DPS_IDENTIFIER_MISSING");
      return{status:invoiceStatusSchema.parse(data.status),dpsIdentifier:data.dps_identifier};
    },
    async record(input){
      const r=input.result;
      const{data,error}=await db.rpc("record_invoice_reconciliation",{
        p_invoice_id:input.invoiceId,p_organization_id:input.organizationId,p_outcome:r.status,
        p_access_key:r.status==="ISSUED"?r.accessKey:null,p_nfse_number:r.status==="ISSUED"?r.nfseNumber:null,
        p_issued_at:r.status==="ISSUED"?r.issuedAt??new Date().toISOString():null,
        p_rejection_code:r.status==="REJECTED"?r.code:null,p_safe_message:r.status==="REJECTED"?r.safeMessage:r.status==="UNKNOWN"?"Estamos confirmando a situação desta nota.":null,
      });
      if(error)throw new Error("INVOICE_RECONCILIATION_PERSIST_FAILED");
      return invoiceStatusSchema.parse(data);
    }
  };
}
