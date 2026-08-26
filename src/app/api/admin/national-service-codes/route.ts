import { NextResponse } from "next/server";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export async function GET(request:Request){try{await requireOfficeSession();const q=new URL(request.url).searchParams.get("q")?.replace(/[%,()]/g,"").trim()??"";let query=createAdminClient().from("national_service_codes").select("id,code,display_code,item,subitem,national_split,description").eq("active",true).order("code").limit(60);if(q)query=query.or(`code.ilike.%${q}%,display_code.ilike.%${q}%,item.ilike.%${q}%,subitem.ilike.%${q}%,description.ilike.%${q}%`);const{data,error}=await query;if(error)throw error;return NextResponse.json({codes:data??[]});}catch{return NextResponse.json({error:"Não foi possível carregar o catálogo nacional."},{status:403});}}
