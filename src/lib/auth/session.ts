import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionOrganization={organizationId:string;role:"SUPER_ADMIN"|"OFFICE_STAFF"|"CLIENT_USER";userId:string};
const getAuthenticatedClient=cache(async()=>{
  const client=await createClient();
  if(!client)return{client:null,user:null};
  const {data:{user}}=await client.auth.getUser();
  return{client,user};
});
const getActiveMemberships=cache(async(userId:string)=>{
  const {client}=await getAuthenticatedClient();
  if(!client)return{data:null,error:new Error("AUTH_CONFIGURATION_REQUIRED")};
  return client.from("memberships").select("organization_id,role").eq("user_id",userId).eq("active",true);
});
export async function requireSessionOrganization():Promise<SessionOrganization>{
  const {client,user}=await getAuthenticatedClient();
  if(!client) throw new Error("AUTH_CONFIGURATION_REQUIRED");
  if(!user) throw new Error("UNAUTHENTICATED");
  const {data,error}=await getActiveMemberships(user.id);
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
  const {client,user}=await getAuthenticatedClient();
  if(!client)throw new Error("AUTH_CONFIGURATION_REQUIRED");
  if(!user)throw new Error("UNAUTHENTICATED");
  const {data:memberships,error}=await getActiveMemberships(user.id);
  const officeMemberships=memberships?.filter(item=>item.role==="SUPER_ADMIN"||item.role==="OFFICE_STAFF");
  if(error||!officeMemberships?.length)throw new Error("FORBIDDEN_OFFICE");
  const displayName=typeof user.user_metadata.full_name==="string"&&user.user_metadata.full_name.trim()
    ?user.user_metadata.full_name.trim()
    :user.email||"Equipe do escritório";
  return{userId:user.id,role:officeMemberships.some(item=>item.role==="SUPER_ADMIN")?"SUPER_ADMIN":"OFFICE_STAFF",displayName};
}

export async function getShellIdentity(){
  const {client,user}=await getAuthenticatedClient();
  if(!client)return null;
  if(!user)return null;
  const {data:memberships}=await getActiveMemberships(user.id);
  const office=memberships?.some(item=>item.role==="SUPER_ADMIN"||item.role==="OFFICE_STAFF")??false;
  const displayName=typeof user.user_metadata.full_name==="string"&&user.user_metadata.full_name.trim()
    ?user.user_metadata.full_name.trim()
    :user.email||"Usuário";
  return{displayName,canAccessOffice:office};
}
