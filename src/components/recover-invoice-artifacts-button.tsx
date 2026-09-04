"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecoverInvoiceArtifactsButton({invoiceId}:{invoiceId:string}){
  const router=useRouter();const[loading,setLoading]=useState(false);const[message,setMessage]=useState("");
  async function recover(){
    setLoading(true);setMessage("");
    try{
      const response=await fetch(`/api/admin/invoices/${invoiceId}/artifacts/recover`,{method:"POST"});
      const body=await response.json() as {error?:string;artifactTypes?:string[];danfseAvailable?:boolean};
      if(!response.ok){setMessage(body.error??"Não foi possível recuperar os documentos oficiais agora.");return;}
      setMessage(body.danfseAvailable?"XML e DANFSe oficiais foram recuperados.":"XML oficial recuperado. O DANFSe ainda não está disponível no ambiente restrito.");
      router.refresh();
    }catch{setMessage("Não foi possível recuperar os documentos oficiais agora.");}finally{setLoading(false);}
  }
  return <div className="reconciliation-action"><button className="button secondary" type="button" disabled={loading} onClick={recover} aria-describedby={message?`artifact-recovery-${invoiceId}`:undefined}><Download size={17}/>{loading?"Recuperando…":"Recuperar documentos oficiais"}</button>{message?<p id={`artifact-recovery-${invoiceId}`} aria-live="polite">{message}</p>:null}</div>;
}
