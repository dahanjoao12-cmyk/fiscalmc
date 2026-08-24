"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData:FormData){const client=await createClient();if(!client&&process.env.NFSE_PROVIDER!=="national")redirect("/app");if(!client)throw new Error("Autenticação não configurada.");const email=String(formData.get("email")??"");const password=String(formData.get("password")??"");const{error}=await client.auth.signInWithPassword({email,password});if(error)redirect("/login?error=invalid_credentials");redirect("/app");}
export async function requestPasswordReset(formData:FormData){const client=await createClient();if(client){const email=String(formData.get("email")??"");const appUrl=process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000";await client.auth.resetPasswordForEmail(email,{redirectTo:`${appUrl}/auth/callback?next=/nova-senha`});}redirect("/login?reset=sent");}
