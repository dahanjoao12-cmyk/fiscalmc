"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function ReconcileInvoiceButton({invoiceId}:{invoiceId:string}){
  const router=useRouter();const[loading,setLoading]=useState(false);const[message,setMessage]=useState("");
  async function reconcile(){setLoading(true);setMessage("");try{const response=await fetch(`/api/admin/invoices/${invoiceId}/reconcile`,{method:"POST"});const body=await response.json()as{error?:string;message?:string};setMessage(response.ok?(body.message??"Situação verificada."):(body.error??"Não foi possível verificar."));if(response.ok)router.refresh();}finally{setLoading(false);}}
  return <div className="reconciliation-action"><button className="button secondary" type="button" disabled={loading} onClick={reconcile}><RefreshCw size={17}/>{loading?"Verificando…":"Verificar situação"}</button>{message&&<p>{message}</p>}</div>;
}
