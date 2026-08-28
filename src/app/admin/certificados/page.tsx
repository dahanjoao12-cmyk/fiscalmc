import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, StatusBadge, formatDate, formatTaxId } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CertificatesPage() {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { data } = await createAdminClient().from("digital_certificates").select("id,organization_id,owner_tax_id,status,valid_until,organizations(legal_name)").is("replaced_at", null).order("valid_until");
  return <div className="page v2-page"><PageHeader title="Certificados" description="Validade e situação dos certificados A1 das empresas." /><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Status</th><th>Validade</th><th>Ação</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td className="v2-table-primary">{item.organizations?.[0]?.legal_name ?? "Empresa"}</td><td>{item.owner_tax_id ? formatTaxId(item.owner_tax_id) : "—"}</td><td><StatusBadge tone={item.status === "VALID" ? "success" : item.status === "EXPIRING" ? "warning" : "danger"}>{item.status === "VALID" ? "Válido" : item.status === "EXPIRING" ? "Vencendo" : "Revisar"}</StatusBadge></td><td>{formatDate(item.valid_until)}</td><td><Link className="v2-text-action" href={`/admin/empresas/${item.organization_id}?tab=certificate`}>Abrir</Link></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum certificado cadastrado" />}</section></div>;
}
