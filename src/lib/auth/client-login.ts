import "server-only";
import { normalizeTaxId, isValidCnpj } from "@/lib/validation/identification";
import { createAdminClient } from "@/lib/supabase/admin";

const INVALID_CREDENTIALS = "CNPJ ou senha inválidos.";

/** Resolves the opaque Supabase Auth identity only on the server. */
export async function signInClientWithCnpj(cnpj: string, password: string, signIn: (email: string, password: string) => Promise<boolean>) {
  const normalized = normalizeTaxId(cnpj);
  if (!isValidCnpj(normalized) || password.length < 1) return { ok: false as const, message: INVALID_CREDENTIALS };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, client_accesses!inner(technical_email, enabled)")
    .eq("tax_id", normalized)
    .eq("client_accesses.enabled", true)
    .maybeSingle();
  if (error || !data) return { ok: false as const, message: INVALID_CREDENTIALS };
  const access = Array.isArray(data.client_accesses) ? data.client_accesses[0] : data.client_accesses;
  if (!access?.technical_email || !(await signIn(access.technical_email, password))) return { ok: false as const, message: INVALID_CREDENTIALS };
  return { ok: true as const };
}

export const clientLoginErrorMessage = INVALID_CREDENTIALS;
