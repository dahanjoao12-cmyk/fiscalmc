"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { clientLoginErrorMessage, signInClientWithCnpj } from "@/lib/auth/client-login";

export async function login(formData:FormData){
  const client=await createClient();
  if(!client&&process.env.NFSE_PROVIDER!=="national") redirect("/app");
  if(!client) redirect("/login?error=invalid_credentials");
  try { assertRateLimit(`client-login:${String(formData.get("cnpj")??"")}`,5,60_000); } catch { redirect("/login?error=rate_limited"); }
  const result=await signInClientWithCnpj(String(formData.get("cnpj")??""),String(formData.get("password")??""),async(email,password)=>!(await client.auth.signInWithPassword({email,password})).error);
  if(!result.ok) redirect(`/login?error=${encodeURIComponent(clientLoginErrorMessage)}`);
  redirect("/app");
}
export async function requestPasswordReset(formData:FormData){const client=await createClient();if(client){const email=String(formData.get("email")??"");const appUrl=process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000";await client.auth.resetPasswordForEmail(email,{redirectTo:`${appUrl}/auth/callback?next=/nova-senha`});}redirect("/login?reset=sent");}
