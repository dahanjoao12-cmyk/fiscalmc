import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";

const optionalDpsCode=z.string().regex(/^\d{3}$/).optional().or(z.literal(""));
const optionalMunicipality=z.string().regex(/^\d{7}$/).optional().or(z.literal(""));
const serviceFields={
  name:z.string().trim().min(2).max(160),
  defaultDescription:z.string().trim().max(1000).optional(),
  municipalServiceMappingId:z.uuid().nullable().optional(),
  dpsMunicipalTaxCode:optionalDpsCode,
  dpsMunicipalTaxCodeSource:z.string().trim().max(320).optional(),
  serviceLocationMunicipalityCode:optionalMunicipality,
};
const createSchema=z.object({nationalServiceCodeId:z.uuid(),...serviceFields,active:z.boolean().optional()});
const updateSchema=z.object({action:z.literal("update"),id:z.uuid(),...serviceFields});
const activationSchema=z.object({action:z.literal("set-active"),id:z.uuid(),active:z.boolean()});
const patchSchema=z.discriminatedUnion("action",[updateSchema,activationSchema]);

type MappingInput={municipalServiceMappingId?:string|null};

async function getOrganizationAndCode(organizationId:string,nationalServiceCodeId:string){
  const db=createAdminClient();
  const[{data:organization},{data:code}]=await Promise.all([
    db.from("organizations").select("municipality_code").eq("id",organizationId).maybeSingle(),
    db.from("national_service_codes").select("id,code").eq("id",nationalServiceCodeId).eq("active",true).maybeSingle(),
  ]);
  return{db,organization,code};
}

async function resolveMapping({db,organizationId,nationalServiceCodeId,mappingInput}:{db:ReturnType<typeof createAdminClient>;organizationId:string;nationalServiceCodeId:string;mappingInput:MappingInput}){
  if(!mappingInput.municipalServiceMappingId)return{municipalServiceCode:null,mappingId:null};
  const{data:organization}=await db.from("organizations").select("municipality_code").eq("id",organizationId).maybeSingle();
  if(!organization)return null;
  const{data:mapping}=await db.from("municipal_service_mappings").select("id,municipal_service_code").eq("id",mappingInput.municipalServiceMappingId).eq("municipality_code",organization.municipality_code).eq("national_service_code_id",nationalServiceCodeId).maybeSingle();
  return mapping?{municipalServiceCode:mapping.municipal_service_code,mappingId:mapping.id}:null;
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await requireOfficeSession();
    const{id}=await params;
    const{data,error}=await createAdminClient().from("service_templates").select("id,name,default_description,active,national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,reviewed_at,reviewed_by,national_service_codes(display_code,description)").eq("organization_id",id).order("name");
    if(error)throw error;
    return NextResponse.json({services:data??[]});
  }catch{
    return NextResponse.json({error:"Acesso do escritório necessário."},{status:403});
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const session=await requireOfficeSession();
    const{id:organizationId}=await params;
    const input=createSchema.parse(await request.json());
    const{db,organization,code}=await getOrganizationAndCode(organizationId,input.nationalServiceCodeId);
    if(!organization||!code)return NextResponse.json({error:"Empresa ou código nacional indisponível."},{status:422});
    const mapping=await resolveMapping({db,organizationId,nationalServiceCodeId:code.id,mappingInput:input});
    if(!mapping)return NextResponse.json({error:"O mapeamento municipal selecionado não é válido para esta empresa."},{status:422});
    const{data,error}=await db.from("service_templates").insert({
      organization_id:organizationId,national_service_code_id:code.id,national_tax_code:code.code,name:input.name,
      default_description:input.defaultDescription||null,municipal_service_code:mapping.municipalServiceCode,
      municipal_service_mapping_id:mapping.mappingId,dps_municipal_tax_code:input.dpsMunicipalTaxCode||null,dps_municipal_tax_code_source:input.dpsMunicipalTaxCode?input.dpsMunicipalTaxCodeSource||null:null,
      service_location_municipality_code:input.serviceLocationMunicipalityCode||null,active:input.active??true,
    }).select("id").single();
    if(error||!data)throw error??new Error("SERVICE_CREATE_FAILED");
    await db.from("audit_logs").insert({organization_id:organizationId,actor_user_id:session.userId,action:"service_template_created",entity:"service_template",entity_id:data.id,safe_metadata:{}});
    return NextResponse.json({service:data},{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof z.ZodError?"Revise os campos do serviço.":"Não foi possível salvar o serviço."},{status:422});
  }
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const session=await requireOfficeSession();
    const{id:organizationId}=await params;
    const input=patchSchema.parse(await request.json());
    const db=createAdminClient();
    const{data:existing}=await db.from("service_templates").select("id,national_service_code_id").eq("id",input.id).eq("organization_id",organizationId).maybeSingle();
    if(!existing)return NextResponse.json({error:"Serviço indisponível para esta empresa."},{status:404});
    if(input.action==="set-active"){
      const{error}=await db.from("service_templates").update({active:input.active}).eq("id",input.id).eq("organization_id",organizationId);
      if(error)throw error;
      await db.from("audit_logs").insert({organization_id:organizationId,actor_user_id:session.userId,action:input.active?"service_template_activated":"service_template_deactivated",entity:"service_template",entity_id:input.id,safe_metadata:{}});
      return NextResponse.json({ok:true});
    }
    const mapping=await resolveMapping({db,organizationId,nationalServiceCodeId:existing.national_service_code_id,mappingInput:input});
    if(!mapping)return NextResponse.json({error:"O mapeamento municipal selecionado não é válido para esta empresa."},{status:422});
    const{error}=await db.from("service_templates").update({
      name:input.name,default_description:input.defaultDescription||null,municipal_service_code:mapping.municipalServiceCode,
      municipal_service_mapping_id:mapping.mappingId,dps_municipal_tax_code:input.dpsMunicipalTaxCode||null,dps_municipal_tax_code_source:input.dpsMunicipalTaxCode?input.dpsMunicipalTaxCodeSource||null:null,
      service_location_municipality_code:input.serviceLocationMunicipalityCode||null,reviewed_at:null,reviewed_by:null,
    }).eq("id",input.id).eq("organization_id",organizationId);
    if(error)throw error;
    await db.from("audit_logs").insert({organization_id:organizationId,actor_user_id:session.userId,action:"service_template_updated",entity:"service_template",entity_id:input.id,safe_metadata:{}});
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({error:error instanceof z.ZodError?"Revise os campos do serviço.":"Não foi possível atualizar o serviço."},{status:422});
  }
}
