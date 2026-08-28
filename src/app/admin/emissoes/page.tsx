import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader, StatusBadge, formatTaxId } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OfficeEmissionsPage() {
  const session = await requireOfficeSession().catch(() => null);
  if (!session) redirect("/app?notice=office");
  const db = createAdminClient();
  const [{ data: companies }, { data: memberships }] = await Promise.all([
    db.from("organizations").select("id,legal_name,tax_id,municipality_code,state,status,emission_blocked").order("legal_name"),
    db.from("memberships").select("organization_id,active").eq("user_id", session.userId).eq("active", true),
  ]);
  const allowed = new Set((memberships ?? []).map((item) => item.organization_id));
  return <div className="page v2-page"><PageHeader title="Emissões" description="Escolha uma empresa para iniciar uma emissão no contexto autorizado." />
    <section className="v2-panel"><div className="v2-panel-heading"><div><h2>Emitir por empresa</h2><p>A emissão continua sujeita à prontidão e às travas fiscais existentes.</p></div></div><div className="v2-company-picker">{(companies ?? []).map((company) => {
      const canIssue = allowed.has(company.id);
      return <div key={company.id}><span><strong>{company.legal_name}</strong><small>{formatTaxId(company.tax_id)} · {company.municipality_code}{company.state ? ` / ${company.state}` : ""}</small></span><StatusBadge tone={company.emission_blocked ? "warning" : "success"}>{company.emission_blocked ? "Bloqueada" : "Pronta"}</StatusBadge>{canIssue ? <Link className="button primary compact" href={`/admin/empresas/${company.id}?tab=issue`}><FilePlus2 size={16} />Emitir</Link> : <span className="v2-muted-action">Sem contexto de emissão</span>}</div>;
    })}</div></section>
  </div>;
}
