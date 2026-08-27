import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ServiceManager } from "@/components/service-manager";
import { FiscalConfigurationForm } from "@/components/fiscal-configuration-form";
import { CertificateManager } from "@/components/certificate-manager";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFiscalConfigurationReadiness } from "@/lib/nfse/fiscal-configuration";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";
import { getCertificateReadiness } from "@/lib/nfse/certificate/status";
import { can } from "@/lib/security/authorization";

const tabs=[['overview','Visão geral'],['fiscal','Dados fiscais'],['services','Serviços'],['certificate','Certificado'],['users','Usuários'],['invoices','Notas'],['logs','Logs']] as const;

export default async function CompanyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}){
  let officeSession;
  try{officeSession=await requireOfficeSession();}catch{redirect('/app?notice=office');}
  const[{id},{tab:requested}]=await Promise.all([params,searchParams]);
  const tab=tabs.some(([key])=>key===requested)?requested??'overview':'overview';
  const db=createAdminClient();const canReadCertificate=can(officeSession.role,"certificate:read");const canManageCertificate=can(officeSession.role,"certificate:write");
  const[{data:company},{data:services},{data:taxProfile},{count:catalogCount},{count:customerCount},{data:certificate},{count:accessCount}]=await Promise.all([
    db.from('organizations').select('id,legal_name,tax_id,municipality_code,status,emission_blocked,municipal_registration,street,address_number,neighborhood,state').eq('id',id).maybeSingle(),
    db.from('service_templates').select('id,name,default_description,active,national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,reviewed_at,reviewed_by,national_service_codes(display_code,description)').eq('organization_id',id).order('name'),
    db.from('tax_profiles').select('tax_regime,dps_configuration,reviewed_at,reviewed_by').eq('organization_id',id).maybeSingle(),
    db.from('national_service_codes').select('id',{count:'exact',head:true}),
    db.from('customers').select('id',{count:'exact',head:true}).eq('organization_id',id),
    canReadCertificate?db.from('digital_certificates').select('id,subject,issuer,serial,owner_tax_id,valid_from,valid_until,status,created_at').eq('organization_id',id).is('replaced_at',null).maybeSingle():Promise.resolve({data:null}),
    db.from('memberships').select('user_id',{count:'exact',head:true}).eq('organization_id',id).eq('active',true),
  ]);
  if(!company)notFound();
  const fiscalReadiness=getFiscalConfigurationReadiness(taxProfile);
  const certificateReadiness=getCertificateReadiness({certificate,organizationTaxId:company.tax_id});
  const serviceDtos=(services??[]).map(item=>({...item,national_service_codes:item.national_service_codes?.[0]??null}));
  const hasReviewedService=serviceDtos.some(service=>getServiceReadiness(service).ready);
  const readiness:Array<{label:string;ok:boolean;tab:(typeof tabs)[number][0]}>= [
    {label:'Cadastro',ok:Boolean(company.municipal_registration&&company.street&&company.address_number&&company.neighborhood&&company.state),tab:'overview'},
    {label:'Fiscal',ok:fiscalReadiness.status==='REVIEWED',tab:'fiscal'},
    {label:'Serviços',ok:hasReviewedService,tab:'services'},
    {label:'Certificado',ok:certificateReadiness.ready,tab:'certificate'},
    {label:'Acesso',ok:Boolean(accessCount),tab:'users'},
  ];
  return <AppShell active="companies" admin><div className="page"><div className="page-heading"><div><h1>{company.legal_name}</h1><p>{company.tax_id} · {company.municipality_code} · {company.state??'UF pendente'}</p></div><span className={`status ${company.emission_blocked?'warning':''}`}>{company.emission_blocked?'Emissão bloqueada':company.status}</span></div><nav className="tabs" aria-label="Seções da empresa">{tabs.map(([key,label])=><Link className={tab===key?'active':''} href={`/admin/empresas/${id}?tab=${key}`} key={key}>{label}</Link>)}</nav>{tab==='overview'&&<><section className="readiness"><h2>Prontidão para emissão</h2>{readiness.map(item=><Link href={`/admin/empresas/${id}?tab=${item.tab}`} key={item.label}><span>{item.ok?'✓':'!'}</span><strong>{item.label}</strong><small>{item.tab==='certificate'&&!item.ok?certificateReadiness.message:item.ok?'Configurado':'Requer atenção do escritório'}</small></Link>)}</section><section className="section"><h2 className="section-title">Resumo cadastral</h2><div className="summary-row"><dt>Status fiscal</dt><dd>{fiscalReadiness.status==='REVIEWED'?'Revisada':fiscalReadiness.status==='INVALID'?'Inválida':'Pendente de revisão'}</dd></div><div className="summary-row"><dt>Tomadores</dt><dd>{customerCount??0}</dd></div><div className="summary-row"><dt>Serviços prontos</dt><dd>{serviceDtos.filter(service=>getServiceReadiness(service).ready).length}</dd></div></section></>}{tab==='services'&&<ServiceManager organizationId={company.id} municipalityCode={company.municipality_code} initialServices={serviceDtos} catalogAvailable={Boolean(catalogCount)}/>} {tab==='fiscal'&&<FiscalConfigurationForm organizationId={company.id} initialConfiguration={fiscalReadiness}/>}{tab==='certificate'&&(canReadCertificate?<CertificateManager organizationId={company.id} organizationTaxId={company.tax_id} initialCertificate={certificate} canWrite={canManageCertificate}/>:<Notice title="Certificado" text="Seu perfil não pode consultar certificados."/>)} {tab==='users'&&<Notice title="Acessos" text={`${accessCount??0} acesso(s) ativo(s) para esta empresa.`}/>} {tab==='invoices'&&<Notice title="Notas fiscais" text="Consulte as emissões reais pela área de notas."/>}{tab==='logs'&&<Notice title="Logs" text="Os eventos técnicos permanecem restritos ao escritório."/>}</div></AppShell>;
}

function Notice({title,text}:{title:string;text:string}){return <section className="empty-state"><strong>{title}</strong><p>{text}</p></section>;}
