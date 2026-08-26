"use client";

import Link from "next/link";
import { Building2, ChevronLeft, CircleAlert, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type CompanyFormState={
  legalName:string;tradeName:string;taxId:string;municipalRegistration:string;municipalityCode:string;
  postalCode:string;street:string;addressNumber:string;addressComplement:string;neighborhood:string;state:string;
  email:string;phone:string;
};

const initialForm:CompanyFormState={legalName:"",tradeName:"",taxId:"",municipalRegistration:"",municipalityCode:"",postalCode:"",street:"",addressNumber:"",addressComplement:"",neighborhood:"",state:"",email:"",phone:""};
const states=["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function digits(value:string){return value.replace(/\D/g,"");}
function formatCnpj(value:string){const x=digits(value).slice(0,14);return x.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");}
function formatCep(value:string){const x=digits(value).slice(0,8);return x.replace(/(\d{5})(\d)/,"$1-$2");}
function formatPhone(value:string){const x=digits(value).slice(0,11);if(x.length<3)return x;return x.length<11?x.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2"):x.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2");}
function isValidCnpj(value:string){const cnpj=digits(value);if(!/^\d{14}$/.test(cnpj)||/^([0-9])\1+$/.test(cnpj))return false;const check=(base:string,weights:number[])=>{const total=weights.reduce((sum,weight,index)=>sum+Number(base[index])*weight,0);const remainder=total%11;return remainder<2?0:11-remainder;};return Number(cnpj[12])===check(cnpj.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])&&Number(cnpj[13])===check(cnpj.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2]);}

export function NewCompanyForm({organizationId,initialValues}:{organizationId?:string;initialValues?:Partial<CompanyFormState>}){
  const router=useRouter();
  const[form,setForm]=useState<CompanyFormState>({...initialForm,...initialValues});
  const[error,setError]=useState("");
  const[saving,setSaving]=useState(false);
  const set=(field:keyof CompanyFormState,value:string)=>setForm(current=>({...current,[field]:value}));
  async function save(event:React.FormEvent){
    event.preventDefault();
    setError("");
    if(!isValidCnpj(form.taxId)){setError("Informe um CNPJ válido para continuar.");return;}
    if(!/^\d{7}$/.test(digits(form.municipalityCode))){setError("Informe o código IBGE de 7 dígitos do município.");return;}
    setSaving(true);
    try{
      const response=await fetch("/api/admin/organizations",{method:organizationId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(organizationId?{id:organizationId,...form}:form)});
      const data=await response.json().catch(()=>null);
      if(!response.ok){setError(data?.error??"Não foi possível criar a empresa. Revise os dados e tente novamente.");return;}
      if(organizationId){router.refresh();return;}
      router.push(`/admin/empresas/${data.organization.id}`);
    }catch{setError("Não foi possível salvar agora. Verifique a conexão e tente novamente.");}
    finally{setSaving(false);}
  }
  return <div className="company-onboarding">
    <form className="company-form" onSubmit={save} noValidate>
      <section className="company-form-section" aria-labelledby="company-identification">
        <div className="form-section-heading"><span className="form-section-icon"><Building2 size={20}/></span><div><h2 id="company-identification">Identificação da empresa</h2><p>Use os dados cadastrais oficiais. Os campos marcados com * são necessários agora.</p></div></div>
        <div className="company-form-grid">
          <Field label="Razão social" required htmlFor="legal-name" className="span-2"><input className="input" id="legal-name" required autoComplete="organization" value={form.legalName} onChange={event=>set("legalName",event.target.value)} placeholder="Ex.: Assessoria Contábil Moreira & Castro"/></Field>
          <Field label="Nome fantasia" htmlFor="trade-name" hint="Opcional"><input className="input" id="trade-name" value={form.tradeName} onChange={event=>set("tradeName",event.target.value)} placeholder="Como a empresa é conhecida"/></Field>
          <Field label="CNPJ" required htmlFor="tax-id" hint="Somente números ou CNPJ formatado"><input className="input" id="tax-id" required inputMode="numeric" autoComplete="off" value={form.taxId} onChange={event=>set("taxId",formatCnpj(event.target.value))} placeholder="00.000.000/0000-00"/></Field>
          <Field label="Código IBGE do município" required htmlFor="municipality-code" hint="7 dígitos"><input className="input" id="municipality-code" required inputMode="numeric" value={form.municipalityCode} onChange={event=>set("municipalityCode",digits(event.target.value).slice(0,7))} placeholder="Ex.: 3304557"/></Field>
          <Field label="Inscrição municipal" htmlFor="municipal-registration" hint="Preencha quando confirmada"><input className="input" id="municipal-registration" value={form.municipalRegistration} onChange={event=>set("municipalRegistration",event.target.value)} placeholder="Número da inscrição municipal"/></Field>
        </div>
      </section>

      <section className="company-form-section" aria-labelledby="company-address">
        <div className="form-section-heading"><span className="form-section-icon"><MapPin size={20}/></span><div><h2 id="company-address">Endereço e contato</h2><p>Esses dados podem ser complementados depois, mas são necessários para a prontidão de emissão.</p></div></div>
        <div className="company-form-grid">
          <Field label="CEP" htmlFor="postal-code"><input className="input" id="postal-code" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={event=>set("postalCode",formatCep(event.target.value))} placeholder="00000-000"/></Field>
          <Field label="UF" htmlFor="state"><select className="input select-input" id="state" value={form.state} onChange={event=>set("state",event.target.value)}><option value="">Selecione</option>{states.map(state=><option key={state} value={state}>{state}</option>)}</select></Field>
          <Field label="Logradouro" htmlFor="street" className="span-2"><input className="input" id="street" autoComplete="address-line1" value={form.street} onChange={event=>set("street",event.target.value)} placeholder="Rua, avenida, praça…"/></Field>
          <Field label="Número" htmlFor="address-number"><input className="input" id="address-number" autoComplete="address-line2" value={form.addressNumber} onChange={event=>set("addressNumber",event.target.value)} placeholder="Ex.: 99"/></Field>
          <Field label="Complemento" htmlFor="address-complement" hint="Opcional"><input className="input" id="address-complement" value={form.addressComplement} onChange={event=>set("addressComplement",event.target.value)} placeholder="Sala, bloco, andar…"/></Field>
          <Field label="Bairro" htmlFor="neighborhood"><input className="input" id="neighborhood" autoComplete="address-level3" value={form.neighborhood} onChange={event=>set("neighborhood",event.target.value)} placeholder="Bairro"/></Field>
          <Field label="E-mail" htmlFor="email"><input className="input" id="email" type="email" autoComplete="email" value={form.email} onChange={event=>set("email",event.target.value)} placeholder="contato@empresa.com.br"/></Field>
          <Field label="Telefone" htmlFor="phone"><input className="input" id="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={event=>set("phone",formatPhone(event.target.value))} placeholder="(00) 00000-0000"/></Field>
        </div>
      </section>

      {error&&<div className="alert error" role="alert"><CircleAlert size={18}/>{error}</div>}
      <div className="company-form-actions"><Link href="/admin/empresas" className="button secondary"><ChevronLeft size={18}/>Cancelar</Link><button className="button primary" disabled={saving}>{saving?<><LoaderCircle className="spin" size={18}/>Salvando cadastro…</>:organizationId?"Salvar dados cadastrais":"Cadastrar empresa"}</button></div>
    </form>
    <aside className="company-onboarding-aside"><div className="onboarding-note"><ShieldCheck size={22}/><h2>Emissão protegida</h2><p>{organizationId?"Alterar o cadastro não libera emissão. A revisão fiscal continua obrigatória.":"A empresa será criada em onboarding, com emissão bloqueada. Nenhuma configuração fiscal será preenchida automaticamente."}</p></div><div className="onboarding-checklist"><h2>Depois do cadastro</h2><ol><li>Revise o cadastro e a inscrição municipal.</li><li>Configure o perfil fiscal com dados confirmados.</li><li>Cadastre serviços, certificado e acessos.</li><li>Libere a emissão somente após a revisão.</li></ol></div></aside>
  </div>;
}

function Field({label,htmlFor,required,hint,className,children}:{label:string;htmlFor:string;required?:boolean;hint?:string;className?:string;children:React.ReactNode}){return <div className={`field company-field${className?` ${className}`:""}`}><label htmlFor={htmlFor}>{label}{required&&<span aria-hidden> *</span>}</label>{children}{hint&&<small className="field-hint">{hint}</small>}</div>;}
