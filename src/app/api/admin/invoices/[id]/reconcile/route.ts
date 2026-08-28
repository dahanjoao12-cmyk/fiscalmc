import { NextResponse } from "next/server";
import { requireOfficeSession } from "@/lib/auth/session";
import { can } from "@/lib/security/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileUnknownInvoice } from "@/lib/nfse/reconciliation/service";
import { SafeFiscalError } from "@/lib/nfse/errors";

export const runtime="nodejs";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=crypto.randomUUID();
  try{
    const session=await requireOfficeSession();
    if(!can(session.role,"invoice:reconcile"))return NextResponse.json({error:"Acesso negado."},{status:403});
    const{id}=await context.params;
    const{data:invoice}=await createAdminClient().from("invoices").select("organization_id").eq("id",id).maybeSingle();
    if(!invoice)return NextResponse.json({error:"Nota não encontrada."},{status:404});
    const result=await reconcileUnknownInvoice({invoiceId:id,organizationId:invoice.organization_id});
    await createAdminClient().from("audit_logs").insert({actor_user_id:session.userId,organization_id:invoice.organization_id,action:"invoice_reconciled",entity:"invoice",entity_id:id,request_id:requestId,safe_metadata:{status:result.status}});
    return NextResponse.json({status:result.status,message:result.status==="UNKNOWN"?"Ainda não foi possível confirmar a situação desta nota.":"Situação atualizada com sucesso."});
  }catch(error){
    if(error instanceof SafeFiscalError)return NextResponse.json({error:error.safeMessage,code:error.code},{status:error.retryable?503:422});
    return NextResponse.json({error:"Não foi possível verificar a situação da nota."},{status:500});
  }
}
