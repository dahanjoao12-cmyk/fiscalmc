import "server-only";
import { createClient } from "@/lib/supabase/server";

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
