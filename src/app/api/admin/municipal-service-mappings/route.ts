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
