"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FiscalConfigurationForm as FiscalForm,FiscalConfigurationStatus } from "@/lib/nfse/fiscal-configuration";

type Configuration={status:FiscalConfigurationStatus;missing:string[];form:FiscalForm;reviewedAt:string|null;reviewedBy:string|null};
const statusLabel:Record<FiscalConfigurationStatus,string>={DRAFT:"Rascunho",PENDING_REVIEW:"Pendente de revisão",REVIEWED:"Revisada",INVALID:"Inválida"};
const choices=[{value:"PENDING_REVIEW",label:"Pendente de revisão"},{value:"CONFIGURED",label:"Configurado"},{value:"NOT_APPLICABLE",label:"Não se aplica"}] as const;

export function FiscalConfigurationForm({organizationId,initialConfiguration}:{organizationId:string;initialConfiguration:Configuration}){
  const router=useRouter();
  const[configuration,setConfiguration]=useState(initialConfiguration);
  const[form,setForm]=useState(initialConfiguration.form);
  const[error,setError]=useState("");
  const[saving,setSaving]=useState(false);
  const set=(field:keyof FiscalForm,value:string|null)=>setForm(current=>({...current,[field]:value}));
  async function request(method:"PATCH"|"POST"){
    setSaving(true);setError("");
    try{const response=await fetch(`/api/admin/organizations/${organizationId}/fiscal`,{method,headers:{"Content-Type":"application/json"},...(method==="PATCH"?{body:JSON.stringify(form)}:{})});const data=await response.json().catch(()=>null);if(!response.ok){setError(data?.error??"Não foi possível atualizar a configuração fiscal.");return;}setConfiguration(data.configuration);setForm(data.configuration.form);router.refresh();}catch{setError("Não foi possível atualizar agora. Tente novamente.");}finally{setSaving(false);}
  }
  return <section className="fiscal-form-wrap">
    <div className="fiscal-form-heading"><div><p className="eyebrow">Perfil fiscal da empresa</p><h2>Configuração fiscal</h2><p>Registre apenas informações confirmadas. Campos pendentes não são assumidos pelo sistema.</p></div><span className={`status ${configuration.status==="REVIEWED"?"":configuration.status==="INVALID"?"error":"warning"}`}>{statusLabel[configuration.status]}</span></div>
    <div className="fiscal-sections">
      <section className="fiscal-section"><h3>Regime tributário</h3><p>O regime administrativo é separado dos códigos técnicos da DPS.</p><div className="fiscal-grid"><Field label="Regime tributário"><select className="input select-input" value={form.taxRegime??""} onChange={event=>set("taxRegime",event.target.value||null)}><option value="">Selecione após confirmação</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></select></Field><StatusField label="Opção pelo Simples" value={form.simplesNational} onChange={value=>set("simplesNational",value)}/><StatusField label="MEI" value={form.mei} onChange={value=>set("mei",value)}/></div></section>
      <section className="fiscal-section"><h3>ISS / NFS-e</h3><p>A alíquota e a regra municipal são resolvidas por operação, não nesta tela.</p><div className="fiscal-grid"><StatusField label="Configuração de ISS" value={form.issConfiguration} onChange={value=>set("issConfiguration",value)}/><StatusField label="Retenção de ISS" value={form.issWithholding} onChange={value=>set("issWithholding",value)}/><StatusField label="Regime especial" value={form.specialRegime} onChange={value=>set("specialRegime",value)}/></div></section>
      <section className="fiscal-section"><h3>IBS/CBS</h3><p>Não são atribuídos códigos ou alíquotas automaticamente.</p><div className="fiscal-grid"><StatusField label="Situação IBS/CBS" value={form.ibsCbs} onChange={value=>set("ibsCbs",value)}/></div></section>
    </div>
    <div className="fiscal-review"><div>{configuration.status==="REVIEWED"?<><CheckCircle2 size={20}/><div><strong>Configuração fiscal revisada</strong><span>{configuration.reviewedAt?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(configuration.reviewedAt)):""}{configuration.reviewedBy?` · ${configuration.reviewedBy}`:""}</span></div></>:<><ShieldCheck size={20}/><div><strong>Revisão humana obrigatória</strong><span>{configuration.missing.length?`Pendências: ${configuration.missing.join(", ")}.`:"A configuração pode ser marcada como revisada."}</span></div></>}</div><div className="fiscal-actions"><button className="button secondary" type="button" disabled={saving} onClick={()=>request("PATCH")}>{saving?<LoaderCircle className="spin" size={18}/>:<Save size={18}/>}Salvar rascunho</button><button className="button primary" type="button" disabled={saving||configuration.missing.length>0} onClick={()=>request("POST")}>{saving?<LoaderCircle className="spin" size={18}/>:<CheckCircle2 size={18}/>}Marcar como revisado</button></div></div>
    {error&&<div className="alert error" role="alert"><CircleAlert size={18}/>{error}</div>}
  </section>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field company-field"><span>{label}</span>{children}</label>}
function StatusField({label,value,onChange}:{label:string;value:FiscalForm["simplesNational"];onChange:(value:"CONFIGURED"|"PENDING_REVIEW"|"NOT_APPLICABLE")=>void}){return <Field label={label}><select className="input select-input" value={value} onChange={event=>onChange(event.target.value as "CONFIGURED"|"PENDING_REVIEW"|"NOT_APPLICABLE")}>{choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></Field>}
