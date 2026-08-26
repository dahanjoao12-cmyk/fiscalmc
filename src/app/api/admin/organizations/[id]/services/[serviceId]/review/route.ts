import { NextResponse } from "next/server";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

export const runtime="nodejs";

export async function POST(_:Request,{params}:{params:Promise<{id:string;serviceId:string}>}){
  try{
    const session=await requireOfficeSession();
    const{id:organizationId,serviceId}=await params;
    const db=createAdminClient();
    const{data:service}=await db.from("service_templates").select("id,active,national_service_code_id,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,reviewed_at").eq("id",serviceId).eq("organization_id",organizationId).maybeSingle();
    if(!service)return NextResponse.json({error:"Serviço indisponível para esta empresa."},{status:404});
    const readiness=getServiceReadiness(service);
    if(readiness.missing.length)return NextResponse.json({error:"Conclua os campos fiscais pendentes antes de revisar.",missing:readiness.missing},{status:422});
    const now=new Date().toISOString();
    const{error}=await db.from("service_templates").update({reviewed_at:now,reviewed_by:session.userId}).eq("id",serviceId).eq("organization_id",organizationId);
    if(error)throw error;
    await db.from("audit_logs").insert({organization_id:organizationId,actor_user_id:session.userId,action:"service_template_reviewed",entity:"service_template",entity_id:serviceId,safe_metadata:{}});
    return NextResponse.json({ok:true,reviewedAt:now,reviewedBy:session.displayName});
  }catch{
    return NextResponse.json({error:"Não foi possível revisar o serviço."},{status:422});
  }
}
