import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const optionalText=(maximum:number)=>z.string().trim().max(maximum).optional().transform(value=>value||null);
const organizationInput=z.object({
  legalName:z.string().trim().min(2).max(250),
  tradeName:optionalText(250),
  taxId:z.string().transform(value=>value.replace(/\D/g,"")).pipe(z.string().regex(/^\d{14}$/)),
  municipalityCode:z.string().transform(value=>value.replace(/\D/g,"")).pipe(z.string().regex(/^\d{7}$/)),
  municipalRegistration:optionalText(80),
  postalCode:z.string().transform(value=>value.replace(/\D/g,"")).pipe(z.string().regex(/^\d{8}$/).or(z.literal(""))).transform(value=>value||null),
  street:optionalText(180),
  addressNumber:optionalText(40),
  addressComplement:optionalText(120),
  neighborhood:optionalText(120),
  state:z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).or(z.literal("")).transform(value=>value||null),
  email:z.string().trim().email().or(z.literal("")).transform(value=>value||null),
  phone:optionalText(40)
});
type OrganizationInput=z.infer<typeof organizationInput>;
function toOrganizationPayload(data:OrganizationInput){return{legal_name:data.legalName,trade_name:data.tradeName,tax_id:data.taxId,municipality_code:data.municipalityCode,municipal_registration:data.municipalRegistration,postal_code:data.postalCode,street:data.street,address_number:data.addressNumber,address_complement:data.addressComplement,neighborhood:data.neighborhood,state:data.state,email:data.email,phone:data.phone};}

export async function POST(request:Request){
  try{
    await requireOfficeSession();
    const data=organizationInput.parse(await request.json());
    const {data:organization,error}=await createAdminClient().from("organizations").insert({...toOrganizationPayload(data),status:"ONBOARDING",emission_blocked:true}).select("id").single();
    if(error)throw error;
    return NextResponse.json({organization},{status:201});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:"Revise os campos obrigatórios e os formatos informados."},{status:400});
    return NextResponse.json({error:"Não foi possível criar a empresa. O CNPJ já pode estar cadastrado."},{status:422});
  }
}

export async function PATCH(request:Request){
  try{
    await requireOfficeSession();
    const input=organizationInput.extend({id:z.string().uuid()}).parse(await request.json());
    const {id,...data}=input;
    const {data:organization,error}=await createAdminClient().from("organizations").update(toOrganizationPayload(data)).eq("id",id).select("id").maybeSingle();
    if(error)throw error;
    if(!organization)return NextResponse.json({error:"Empresa não encontrada."},{status:404});
    return NextResponse.json({organization});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:"Revise os campos obrigatórios e os formatos informados."},{status:400});
    return NextResponse.json({error:"Não foi possível atualizar o cadastro da empresa."},{status:422});
  }
}
