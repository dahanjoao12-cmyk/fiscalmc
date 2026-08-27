import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
type CompanyTab=(typeof tabs)[number][0];

export default async function CompanyPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}){
  let officeSession;
  try{officeSession=await requireOfficeSession();}catch{redirect('/app?notice=office');}
  const[{id},{tab:requested}]=await Promise.all([params,searchParams]);
  const tab:CompanyTab=tabs.some(([key])=>key===requested)?requested as CompanyTab:'overview';
  const isOverview=tab==='overview';
  const needsServices=isOverview||tab==='services';
  const needsFiscal=isOverview||tab==='fiscal';
  const needsCertificate=isOverview||tab==='certificate';
  const needsCustomerCount=isOverview;
  const needsAccessCount=isOverview||tab==='users';
  const db=createAdminClient();
  const canReadCertificate=can(officeSession.role,"certificate:read");
  const canManageCertificate=can(officeSession.role,"certificate:write");
  const [companyResult,servicesResult,taxProfileResult,catalogResult,customerResult,certificateResult,accessResult]=await Promise.all([
    db.from('organizations').select('id,legal_name,tax_id,municipality_code,status,emission_blocked,municipal_registration,street,address_number,neighborhood,state').eq('id',id).maybeSingle(),
    needsServices?db.from('service_templates').select('id,name,default_description,active,national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,reviewed_at,reviewed_by,national_service_codes(display_code,description)').eq('organization_id',id).order('name'):Promise.resolve({data:[]}),
    needsFiscal?db.from('tax_profiles').select('tax_regime,dps_configuration,reviewed_at,reviewed_by').eq('organization_id',id).maybeSingle():Promise.resolve({data:null}),
    tab==='services'?db.from('national_service_codes').select('id',{count:'exact',head:true}):Promise.resolve({count:0}),
    needsCustomerCount?db.from('customers').select('id',{count:'exact',head:true}).eq('organization_id',id):Promise.resolve({count:0}),
    needsCertificate&&canReadCertificate?db.from('digital_certificates').select('id,subject,issuer,serial,owner_tax_id,valid_from,valid_until,status,created_at').eq('organization_id',id).is('replaced_at',null).maybeSingle():Promise.resolve({data:null}),
    needsAccessCount?db.from('memberships').select('user_id',{count:'exact',head:true}).eq('organization_id',id).eq('active',true):Promise.resolve({count:0}),
  ]);
  const company=companyResult.data;
  if(!company)notFound();
  const services=servicesResult.data??[];
  const fiscalReadiness=getFiscalConfigurationReadiness(taxProfileResult.data);
  const certificateReadiness=getCertificateReadiness({certificate:certificateResult.data,organizationTaxId:company.tax_id});
  const serviceDtos=services.map(item=>({...item,national_service_codes:item.national_service_codes?.[0]??null}));
  const hasReviewedService=serviceDtos.some(service=>getServiceReadiness(service).ready);
  const readiness:Array<{label:string;ok:boolean;tab:CompanyTab}>= [
    {label:'Cadastro',ok:Boolean(company.municipal_registration&&company.street&&company.address_number&&company.neighborhood&&company.state),tab:'overview'},
    {label:'Fiscal',ok:fiscalReadiness.status==='REVIEWED',tab:'fiscal'},
    {label:'Serviços',ok:hasReviewedService,tab:'services'},
    {label:'Certificado',ok:certificateReadiness.ready,tab:'certificate'},
    {label:'Acesso',ok:Boolean(accessResult.count),tab:'users'},
  ];
  return <div className="page"><div className="page-heading"><div><h1>{company.legal_name}</h1><p>{company.tax_id} · {company.municipality_code} · {company.state??'UF pendente'}</p></div><span className={`status ${company.emission_blocked?'warning':''}`}>{company.emission_blocked?'Emissão bloqueada':company.status}</span></div><nav className="tabs" aria-label="Seções da empresa">{tabs.map(([key,label])=><Link className={tab===key?'active':''} href={`/admin/empresas/${id}?tab=${key}`} key={key}>{label}</Link>)}</nav>{tab==='overview'&&<><section className="readiness"><h2>Prontidão para emissão</h2>{readiness.map(item=><Link href={`/admin/empresas/${id}?tab=${item.tab}`} key={item.label}><span>{item.ok?'✓':'!'}</span><strong>{item.label}</strong><small>{item.tab==='certificate'&&!item.ok?certificateReadiness.message:item.ok?'Configurado':'Requer atenção do escritório'}</small></Link>)}</section><section className="section"><h2 className="section-title">Resumo cadastral</h2><div className="summary-row"><dt>Status fiscal</dt><dd>{fiscalReadiness.status==='REVIEWED'?'Revisada':fiscalReadiness.status==='INVALID'?'Inválida':'Pendente de revisão'}</dd></div><div className="summary-row"><dt>Tomadores</dt><dd>{customerResult.count??0}</dd></div><div className="summary-row"><dt>Serviços prontos</dt><dd>{serviceDtos.filter(service=>getServiceReadiness(service).ready).length}</dd></div></section></>}{tab==='services'&&<ServiceManager organizationId={company.id} municipalityCode={company.municipality_code} initialServices={serviceDtos} catalogAvailable={Boolean(catalogResult.count)}/>} {tab==='fiscal'&&<FiscalConfigurationForm organizationId={company.id} initialConfiguration={fiscalReadiness}/>}{tab==='certificate'&&(canReadCertificate?<CertificateManager organizationId={company.id} organizationTaxId={company.tax_id} initialCertificate={certificateResult.data} canWrite={canManageCertificate}/>:<Notice title="Certificado" text="Seu perfil não pode consultar certificados."/>)} {tab==='users'&&<Notice title="Acessos" text={`${accessResult.count??0} acesso(s) ativo(s) para esta empresa.`}/>} {tab==='invoices'&&<Notice title="Notas fiscais" text="Consulte as emissões reais pela área de notas."/>}{tab==='logs'&&<Notice title="Logs" text="Os eventos técnicos permanecem restritos ao escritório."/>}</div>;
}

function Notice({title,text}:{title:string;text:string}){return <section className="empty-state"><strong>{title}</strong><p>{text}</p></section>;}
