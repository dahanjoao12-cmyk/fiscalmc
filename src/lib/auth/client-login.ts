import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLIENT_AUTH_ERROR, normalizeClientCnpj } from "./client-access-model";

type ResolvedClientAccess = { technicalEmail: string; userId: string } | null;

async function resolveClientAccess(cnpj: string): Promise<ResolvedClientAccess> {
  const admin = createAdminClient();
  const { data: organization, error } = await admin.from("organizations").select("id").eq("tax_id", cnpj).maybeSingle();
  if (error || !organization) return null;
  const { data: access, error: accessError } = await admin.from("client_accesses").select("technical_email,user_id,enabled").eq("organization_id", organization.id).eq("enabled", true).maybeSingle();
  if (accessError || !access) return null;
  const { data: membership, error: membershipError } = await admin.from("memberships").select("role,active").eq("organization_id", organization.id).eq("user_id", access.user_id).eq("role", "CLIENT_USER").eq("active", true).maybeSingle();
  if (membershipError || !membership) return null;
  return { technicalEmail: access.technical_email, userId: access.user_id };
}

/** Resolves the opaque Supabase Auth identity only on the server. */
export async function signInClientWithCnpj(cnpj: string, password: string, signIn: (email: string, password: string) => Promise<boolean>, resolve: (cnpj: string) => Promise<ResolvedClientAccess> = resolveClientAccess) {
  const normalized = normalizeClientCnpj(cnpj);
  if (!normalized || password.length < 1) return { ok: false as const, message: CLIENT_AUTH_ERROR };
  const access = await resolve(normalized);
  if (!access?.technicalEmail || !(await signIn(access.technicalEmail, password))) return { ok: false as const, message: CLIENT_AUTH_ERROR };
  return { ok: true as const };
}

export const clientLoginErrorMessage = CLIENT_AUTH_ERROR;
