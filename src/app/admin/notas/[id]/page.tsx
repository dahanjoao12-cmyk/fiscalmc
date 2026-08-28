import { AlertTriangle, Building2, FileText, History, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ReconcileInvoiceButton } from "@/components/reconcile-invoice-button";
import { PageHeader, StatusBadge, formatCurrency, formatDate, formatDateTime } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const labels: Record<string, string> = { ISSUED: "Emitida", REJECTED: "Rejeitada", UNKNOWN: "Verificação necessária", CANCELLED: "Cancelada", READY: "Em análise", SUBMITTING: "Em análise" };
export default async function AdminInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: invoice }, { data: attempts }] = await Promise.all([
    db.from("invoices").select("id,dps_number,nfse_number,amount_cents,status,service_date,description,access_key,issued_at,created_at,organizations(legal_name,tax_id),customers(legal_name,tax_id),service_templates(name)").eq("id", id).maybeSingle(),
    db.from("invoice_attempts").select("id,status,safe_error_message,started_at,finished_at").eq("invoice_id", id).order("started_at", { ascending: false }),
  ]);
  if (!invoice) notFound();
  const tone = invoice.status === "ISSUED" ? "success" : invoice.status === "REJECTED" ? "danger" : "warning";
  return <div className="page v2-page invoice-document"><PageHeader backHref="/admin/notas" backLabel="Notas" title={`NFS-e ${invoice.nfse_number ?? invoice.dps_number ?? "em preparação"}`} description={`Competência ${formatDate(invoice.service_date)}`} actions={<StatusBadge tone={tone}>{labels[invoice.status] ?? invoice.status}</StatusBadge>} />
    {invoice.status === "UNKNOWN" ? <section className="v2-alert-callout"><AlertTriangle size={21} /><div><strong>Verificação necessária</strong><p>A transmissão pode ter sido recebida. A nota não será reenviada automaticamente.</p></div><ReconcileInvoiceButton invoiceId={invoice.id} /></section> : null}
    <div className="v2-document-grid"><section className="v2-panel v2-document-section"><h2><Building2 size={19} />Prestador</h2><dl><div><dt>Empresa</dt><dd>{invoice.organizations?.[0]?.legal_name ?? "—"}</dd></div><div><dt>CNPJ</dt><dd>{invoice.organizations?.[0]?.tax_id ?? "—"}</dd></div></dl></section><section className="v2-panel v2-document-section"><h2><UserRound size={19} />Tomador</h2><dl><div><dt>Nome</dt><dd>{invoice.customers?.[0]?.legal_name ?? "—"}</dd></div><div><dt>CPF/CNPJ</dt><dd>{invoice.customers?.[0]?.tax_id ?? "—"}</dd></div></dl></section></div>
    <section className="v2-panel v2-document-section"><h2><FileText size={19} />Serviço e valores</h2><dl className="columns"><div><dt>Serviço</dt><dd>{invoice.service_templates?.[0]?.name ?? "—"}</dd></div><div><dt>Valor</dt><dd className="document-total">{formatCurrency(invoice.amount_cents)}</dd></div><div className="span"><dt>Descrição</dt><dd>{invoice.description}</dd></div>{invoice.access_key ? <div className="span"><dt>Chave de acesso</dt><dd className="break-all">{invoice.access_key}</dd></div> : null}</dl></section>
    <section className="v2-panel v2-timeline"><h2><History size={19} />Histórico</h2><ol><li><span /><div><strong>Nota criada</strong><small>{formatDateTime(invoice.created_at)}</small></div></li>{(attempts ?? []).map((attempt) => <li key={attempt.id}><span /><div><strong>{attempt.status.replaceAll("_", " ")}</strong><small>{formatDateTime(attempt.finished_at ?? attempt.started_at)}{attempt.safe_error_message ? ` · ${attempt.safe_error_message}` : ""}</small></div></li>)}</ol></section>
  </div>;
}
