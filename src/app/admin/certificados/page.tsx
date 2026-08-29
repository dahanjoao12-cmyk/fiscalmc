import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, StatusBadge, formatDate, formatTaxId } from "@/components/ui-kit";
import { certificateHolderName } from "@/lib/nfse/certificate/presentation";
import { certificateDaysRemaining, getCertificateOperationalState } from "@/lib/operations/queue";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CertificatesPage() {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { data } = await createAdminClient().from("digital_certificates").select("id,organization_id,owner_tax_id,status,subject,valid_until,organizations(legal_name)").is("replaced_at", null).order("valid_until");
  return <div className="page v2-page"><PageHeader title="Certificados" description="Validade e situação dos certificados A1 das empresas." /><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Titular</th><th>Status</th><th>Validade</th><th>Dias restantes</th><th>Ação</th></tr></thead><tbody>{data.map((item) => { const state = getCertificateOperationalState({ status: item.status, validUntil: item.valid_until }); const tone = state?.type === "CERTIFICATE_EXPIRED" ? "danger" : state ? "warning" : "success"; const label = state?.type === "CERTIFICATE_EXPIRED" ? "Vencido" : state ? "Vencendo" : item.status === "VALID" ? "Válido" : "Inválido"; const days = state?.daysRemaining ?? certificateDaysRemaining(item.valid_until); return <tr key={item.id}><td className="v2-table-primary">{item.organizations?.[0]?.legal_name ?? "Empresa"}</td><td>{item.owner_tax_id ? formatTaxId(item.owner_tax_id) : "—"}</td><td>{certificateHolderName(item.subject)}</td><td><StatusBadge tone={tone}>{label}</StatusBadge></td><td>{formatDate(item.valid_until)}</td><td>{days < 0 ? "Vencido" : `${days} dia(s)`}</td><td><Link className="v2-text-action" href={`/admin/empresas/${item.organization_id}?tab=certificate`}>Abrir</Link></td></tr>; })}</tbody></table></div> : <EmptyState title="Nenhum certificado cadastrado" />}</section></div>;
}
