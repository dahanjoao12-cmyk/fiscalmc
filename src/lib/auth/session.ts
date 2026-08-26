import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SessionOrganization={organizationId:string;role:"SUPER_ADMIN"|"OFFICE_STAFF"|"CLIENT_USER";userId:string};
export async function requireSessionOrganization():Promise<SessionOrganization>{
  const client=await createClient();
  if(!client) throw new Error("AUTH_CONFIGURATION_REQUIRED");
  const {data:{user}}=await client.auth.getUser();
  if(!user) throw new Error("UNAUTHENTICATED");
  const {data,error}=await client.from("memberships").select("organization_id,role").eq("user_id",user.id).eq("active",true).limit(2);
  if(error||!data?.length) throw new Error("FORBIDDEN_ORGANIZATION");
  if(data.length>1) throw new Error("ORGANIZATION_CONTEXT_REQUIRED");
  return {organizationId:data[0].organization_id,role:data[0].role,userId:user.id};
}

/** Server Components redirect unauthenticated visitors; API routes retain HTTP error responses. */
export async function requireClientPageSession():Promise<SessionOrganization>{
  try{return await requireSessionOrganization();}catch{redirect("/login");}
}

export type OfficeSession={userId:string;role:"SUPER_ADMIN"|"OFFICE_STAFF";displayName:string};
export async function requireOfficeSession():Promise<OfficeSession>{
  const client=await createClient();
  if(!client)throw new Error("AUTH_CONFIGURATION_REQUIRED");
  const {data:{user}}=await client.auth.getUser();
  if(!user)throw new Error("UNAUTHENTICATED");
  const {data:memberships,error}=await client.from("memberships").select("role").eq("user_id",user.id).eq("active",true).in("role",["SUPER_ADMIN","OFFICE_STAFF"]);
  if(error||!memberships?.length)throw new Error("FORBIDDEN_OFFICE");
  const {data:profile}=await createAdminClient().from("profiles").select("full_name").eq("user_id",user.id).maybeSingle();
  return{userId:user.id,role:memberships.some(item=>item.role==="SUPER_ADMIN")?"SUPER_ADMIN":"OFFICE_STAFF",displayName:profile?.full_name||user.email||"Equipe do escritório"};
}

export async function getShellIdentity(){
  const client=await createClient();
  if(!client)return null;
  const {data:{user}}=await client.auth.getUser();
  if(!user)return null;
  const [{data:profile},{data:memberships}]=await Promise.all([
    client.from("profiles").select("full_name").eq("user_id",user.id).maybeSingle(),
    client.from("memberships").select("organization_id,role").eq("user_id",user.id).eq("active",true)
  ]);
  const office=memberships?.some(item=>item.role==="SUPER_ADMIN"||item.role==="OFFICE_STAFF")??false;
  return{displayName:profile?.full_name||user.email||"Usuário",canAccessOffice:office};
}
