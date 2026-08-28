import Link from "next/link";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { InvoiceList, type InvoiceRow } from "@/components/invoice-list";
import { MetricTile, PageHeader, StatusBadge, formatCurrency } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardPage() {
  const session = await requireClientPageSession();
  const db = createAdminClient();
  const month = new Date().toISOString().slice(0, 7);
  const [{ data: invoices }, { data: organization }] = await Promise.all([
    db.from("invoices").select("id,dps_number,amount_cents,status,service_date,created_at,customers(legal_name),service_templates(name)").eq("organization_id", session.organizationId).gte("service_date", `${month}-01`).order("created_at", { ascending: false }).limit(20),
    db.from("organizations").select("legal_name,emission_blocked").eq("id", session.organizationId).maybeSingle(),
  ]);
  const rows: InvoiceRow[] = (invoices ?? []).map((item) => ({ id: item.id, number: item.dps_number?.toString() ?? "—", amountCents: item.amount_cents, status: item.status, date: item.service_date, customer: item.customers?.[0]?.legal_name ?? "Tomador não disponível", service: item.service_templates?.[0]?.name ?? "Serviço não disponível" }));
  const pending = rows.filter((item) => item.status === "UNKNOWN" || item.status === "REJECTED").length;
  return <div className="page v2-page client-dashboard"><PageHeader title="Início" description={`Operação fiscal de ${organization?.legal_name ?? "sua empresa"}.`} />
    <section className="v2-client-hero"><div><h2>Emitir uma nova NFS-e</h2><p>Informe o tomador, serviço e valor. A configuração fiscal é aplicada automaticamente.</p></div><Link className="button primary" href="/app/emitir"><FilePlus2 size={19} />Emitir NFS-e<ArrowRight size={17} /></Link></section>
    {organization?.emission_blocked ? <div className="v2-client-notice"><StatusBadge tone="warning">Atenção</StatusBadge><span>A emissão permanece bloqueada até a conclusão das pendências pelo escritório.</span></div> : null}
    <section className="v2-metrics client-metrics"><MetricTile label="Notas emitidas no mês" value={String(rows.filter((item) => item.status === "ISSUED").length)} /><MetricTile label="Valor no mês" value={formatCurrency(rows.filter((item) => item.status === "ISSUED").reduce((sum, item) => sum + item.amountCents, 0))} /><MetricTile label="Pendências" value={String(pending)} tone={pending ? "warning" : "default"} /></section>
    <InvoiceList rows={rows} />
  </div>;
}
