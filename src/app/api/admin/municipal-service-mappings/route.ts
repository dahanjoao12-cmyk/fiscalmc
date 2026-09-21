import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request:Request){
  try{
    await requireOfficeSession();
    const url=new URL(request.url);
    const municipalityCode=z.string().regex(/^\d{7}$/).parse(url.searchParams.get("municipalityCode"));
    const nationalServiceCodeId=z.string().uuid().parse(url.searchParams.get("nationalServiceCodeId"));
    const competenceParam=url.searchParams.get("competence");
    const competence=competenceParam?z.iso.date().parse(competenceParam):null;
    let query=createAdminClient().from("municipal_service_mappings").select("id,municipal_service_code,valid_from,valid_until,source,source_version").eq("municipality_code",municipalityCode).eq("national_service_code_id",nationalServiceCodeId).order("valid_from",{ascending:false});
    if(competence)query=query.or(`valid_from.is.null,valid_from.lte.${competence}`).or(`valid_until.is.null,valid_until.gte.${competence}`);
    const {data,error}=await query;
    if(error)throw error;
    return NextResponse.json({mappings:data??[]});
  }catch{return NextResponse.json({error:"Não foi possível carregar os mapeamentos municipais."},{status:403});}
}

const createSchema=z.object({
  municipalityCode:z.string().regex(/^\d{7}$/),
  nationalServiceCodeId:z.uuid(),
  municipalServiceCode:z.string().trim().min(1).max(60),
  source:z.string().trim().min(3).max(320),
  sourceVersion:z.string().trim().max(160).optional(),
  validFrom:z.iso.date().optional(),
}).strict();

export async function POST(request:Request){
  try{
    const session=await requireOfficeSession();
    const input=createSchema.parse(await request.json());
    const db=createAdminClient();
    const {data,error}=await db.from("municipal_service_mappings").insert({
      municipality_code:input.municipalityCode,
      national_service_code_id:input.nationalServiceCodeId,
      municipal_service_code:input.municipalServiceCode,
      source:input.source,
      source_version:input.sourceVersion||null,
      valid_from:input.validFrom||null,
    }).select("id,municipal_service_code,valid_from,valid_until,source,source_version").single();
    if(error){
      if(error.code==="23505")return NextResponse.json({error:"Já existe um de/para com esses mesmos dados para este município e código nacional."},{status:409});
      throw error;
    }
    await db.from("audit_logs").insert({actor_user_id:session.userId,actor_type:"OFFICE",action:"municipal_service_mapping_created",entity:"municipal_service_mapping",entity_id:data.id,safe_metadata:{municipalityCode:input.municipalityCode,nationalServiceCodeId:input.nationalServiceCodeId}});
    return NextResponse.json({mapping:data},{status:201});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:"Revise os campos do de/para municipal."},{status:400});
    return NextResponse.json({error:"Não foi possível cadastrar o de/para municipal."},{status:403});
  }
}
