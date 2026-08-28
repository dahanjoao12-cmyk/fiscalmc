import { PageHeader } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientProfilePage() {
  const session = await requireClientPageSession();
  const { data } = await createAdminClient().from("organizations").select("legal_name,tax_id,municipality_code,state,email,phone").eq("id", session.organizationId).maybeSingle();
  return <div className="page v2-page"><PageHeader title="Perfil" description="Dados principais da sua empresa." /><section className="v2-panel"><dl className="v2-definition-list spacious"><div><dt>Empresa</dt><dd>{data?.legal_name ?? "—"}</dd></div><div><dt>CNPJ</dt><dd>{data?.tax_id ?? "—"}</dd></div><div><dt>Município</dt><dd>{data?.municipality_code ?? "—"}{data?.state ? ` / ${data.state}` : ""}</dd></div><div><dt>Email</dt><dd>{data?.email ?? "—"}</dd></div><div><dt>Telefone</dt><dd>{data?.phone ?? "—"}</dd></div></dl></section></div>;
}
