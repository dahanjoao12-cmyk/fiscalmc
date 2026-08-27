import { z } from "zod";
import { isValidCnpj, normalizeTaxId } from "@/lib/validation/identification";

export const CLIENT_AUTH_ERROR = "CNPJ ou senha inválidos.";
export const CLIENT_PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z.string().min(CLIENT_PASSWORD_MIN_LENGTH).max(128);
export const passwordConfirmationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((input) => input.password === input.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

export function normalizeClientCnpj(value: string) {
  const normalized = normalizeTaxId(value);
  return /^\d{14}$/.test(normalized) && isValidCnpj(normalized) ? normalized : null;
}

function normalizeNamespace(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!normalized) throw new Error("AUTH_IDENTITY_NAMESPACE_INVALID");
  return normalized.slice(0, 40);
}

export function getTechnicalIdentityNamespace() {
  const explicit = process.env.CLIENT_AUTH_NAMESPACE;
  if (explicit) return normalizeNamespace(explicit);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try { return normalizeNamespace(new URL(url).hostname.split(".")[0] ?? ""); }
    catch { throw new Error("AUTH_IDENTITY_NAMESPACE_INVALID"); }
  }
  return normalizeNamespace(process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development");
}

/** Internal Supabase Auth identity. It must never be presented to the client. */
export function buildTechnicalClientEmail(cnpj: string, namespace = getTechnicalIdentityNamespace()) {
  const normalized = normalizeClientCnpj(cnpj);
  if (!normalized) throw new Error("INVALID_ORGANIZATION_CNPJ");
  return `client.${normalizeNamespace(namespace)}.${normalized}@auth.fiscalmc.internal`;
}

export type ClientAccessReadinessInput = {
  access: { enabled: boolean } | null;
  membership: { active: boolean; role: string } | null;
  authUserActive: boolean;
};

export function getClientAccessReadiness(input: ClientAccessReadinessInput) {
  if (!input.access) return { ready: false, status: "MISSING" as const, message: "Acesso do cliente não cadastrado." };
  if (!input.access.enabled || !input.membership?.active) return { ready: false, status: "BLOCKED" as const, message: "Acesso do cliente bloqueado." };
  if (input.membership.role !== "CLIENT_USER" || !input.authUserActive) return { ready: false, status: "INVALID" as const, message: "Acesso do cliente precisa ser revisado." };
  return { ready: true, status: "ACTIVE" as const, message: "Acesso principal ativo." };
}
