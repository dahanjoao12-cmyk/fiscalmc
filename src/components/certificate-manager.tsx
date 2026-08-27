"use client";

import { useRef,useState } from "react";
import { CheckCircle2,ShieldAlert,Upload,XCircle } from "lucide-react";
import { getCertificateReadiness,type StoredCertificateStatus } from "@/lib/nfse/certificate/status";

type Certificate={id:string;subject:string;issuer:string;serial:string;owner_tax_id:string|null;valid_from:string;valid_until:string;status:StoredCertificateStatus;created_at?:string};
function formatTaxId(value:string){return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,"$1.$2.$3/$4-$5");}
function formatDate(value:string){return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(value));}

export function CertificateManager({organizationId,organizationTaxId,initialCertificate}:{organizationId:string;organizationTaxId:string;initialCertificate:Certificate|null}){
  const[certificate,setCertificate]=useState(initialCertificate),[file,setFile]=useState<File|null>(null),[password,setPassword]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const readiness=getCertificateReadiness({certificate,organizationTaxId});
  async function upload(){
    if(!file||!password){setError("Selecione o arquivo e informe a senha.");return;}
    setSaving(true);setError("");
    const form=new FormData();form.set("file",file);form.set("password",password);
    try{
      const response=await fetch(`/api/admin/organizations/${organizationId}/certificate`,{method:"POST",body:form});
      const result=await response.json();
      if(!response.ok){setError(result.error??"Não foi possível cadastrar o certificado.");return;}
      setCertificate(result.certificate);setFile(null);setPassword("");if(fileInput.current)fileInput.current.value="";
    }catch{setError("Não foi possível cadastrar o certificado.");}
    finally{setSaving(false);}
  }
  return <section className="certificate-manager"><div className="certificate-header"><div><p className="eyebrow">Certificado digital A1</p><h2>{certificate?readiness.message:"Nenhum certificado cadastrado."}</h2><p>O arquivo e a senha são tratados exclusivamente no servidor.</p></div>{certificate?(readiness.ready?<CheckCircle2 className="certificate-icon valid"/>:<XCircle className="certificate-icon invalid"/>):<ShieldAlert className="certificate-icon"/>}</div>{certificate&&<dl className="certificate-details"><div><dt>Titular</dt><dd>{certificate.subject}</dd></div><div><dt>CNPJ</dt><dd>{certificate.owner_tax_id?formatTaxId(certificate.owner_tax_id):"Não identificado"}</dd></div><div><dt>Validade</dt><dd>{formatDate(certificate.valid_until)}</dd></div><div><dt>Status</dt><dd><span className={`status ${readiness.warning||!readiness.ready?"warning":""}`}>{readiness.status==="EXPIRING"?"Vence em breve":readiness.status==="VALID"?"Válido":readiness.status}</span></dd></div></dl>}<div className="certificate-upload"><label>Arquivo A1 (.pfx ou .p12)<input ref={fileInput} type="file" accept=".pfx,.p12,application/x-pkcs12,application/octet-stream" onChange={event=>setFile(event.target.files?.[0]??null)}/></label><label>Senha do certificado<input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Informe somente para validar e cadastrar"/></label>{error&&<p className="alert error">{error}</p>}<button className="button primary" type="button" onClick={upload} disabled={saving}><Upload size={18}/>{saving?"Validando…":certificate?"Substituir certificado":"Validar e cadastrar"}</button></div></section>;
}
