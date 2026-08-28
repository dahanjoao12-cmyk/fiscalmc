import Link from "next/link";
import { AlertTriangle, FileText, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { InvoiceTimeline } from "@/components/invoice-timeline";
import { ReconcileInvoiceButton } from "@/components/reconcile-invoice-button";
import { PageHeader, StatusBadge, formatCurrency, formatDate, formatDateTime } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { getInvoicePresentation } from "@/lib/invoices/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireClientPageSession()]);
  const db = createAdminClient();
  const [{ data: invoice }, { data: attempts }] = await Promise.all([
    db.from("invoices").select("id,dps_number,amount_cents,status,service_date,description,access_key,nfse_number,issued_at,created_at,updated_at,safe_status_message,last_reconciled_at,customers(legal_name,tax_id),service_templates(name)").eq("id", id).eq("organization_id", session.organizationId).maybeSingle(),
    db.from("invoice_attempts").select("id,status,safe_error_message,started_at,finished_at").eq("invoice_id", id).eq("organization_id", session.organizationId).order("started_at", { ascending: false }),
  ]);
  if (!invoice) notFound();
  const presentation = getInvoicePresentation(invoice.status, invoice.safe_status_message);
  const title = invoice.nfse_number ? `NFS-e nº ${invoice.nfse_number}` : "Solicitação de NFS-e";
  return <div className="page v2-page invoice-document"><PageHeader backHref="/app/notas" backLabel="Notas" title={title} description={`Competência ${formatDate(invoice.service_date)}`} actions={<StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>} />
    <section className={`v2-status-callout is-${presentation.tone}`}><AlertTriangle size={21} aria-hidden /><div><strong>{presentation.title}</strong><p>{presentation.description}</p>{presentation.action === "OFFICE_ACTION_REQUIRED" ? <p className="v2-status-action">Essa configuração precisa ser revisada pela Moreira & Castro.</p> : null}</div>{invoice.status === "UNKNOWN" ? <ReconcileInvoiceButton invoiceId={invoice.id} scope="client" /> : null}</section>
    <div className="v2-document-grid"><section className="v2-panel v2-document-section"><h2><UserRound size={19} aria-hidden />Tomador</h2><dl><div><dt>Nome</dt><dd>{invoice.customers?.[0]?.legal_name ?? "—"}</dd></div><div><dt>CPF/CNPJ</dt><dd>{invoice.customers?.[0]?.tax_id ?? "—"}</dd></div></dl></section><section className="v2-panel v2-document-section"><h2><FileText size={19} aria-hidden />Serviço</h2><dl><div><dt>Serviço</dt><dd>{invoice.service_templates?.[0]?.name ?? "—"}</dd></div><div><dt>Valor</dt><dd className="document-total">{formatCurrency(invoice.amount_cents)}</dd></div></dl></section></div>
    <section className="v2-panel v2-document-section"><h2>Resumo da nota</h2><dl className="columns"><div><dt>Data da prestação</dt><dd>{formatDate(invoice.service_date)}</dd></div>{invoice.issued_at ? <div><dt>Data da emissão</dt><dd>{formatDateTime(invoice.issued_at)}</dd></div> : null}{invoice.nfse_number ? <div><dt>Número da NFS-e</dt><dd>{invoice.nfse_number}</dd></div> : null}<div className="span"><dt>Descrição</dt><dd>{invoice.description}</dd></div>{invoice.access_key ? <div className="span"><dt>Chave de acesso</dt><dd className="break-all">{invoice.access_key}</dd></div> : null}</dl></section>
    <InvoiceTimeline createdAt={invoice.created_at} status={invoice.status} issuedAt={invoice.issued_at} updatedAt={invoice.updated_at} lastReconciledAt={invoice.last_reconciled_at} attempts={(attempts ?? []).map((attempt) => ({ id: attempt.id, status: attempt.status, safeMessage: attempt.safe_error_message, startedAt: attempt.started_at, finishedAt: attempt.finished_at }))} />
    <section className="v2-document-actions">{invoice.status !== "UNKNOWN" ? <Link className="button primary" href="/app/emitir">Emitir outra NFS-e</Link> : null}{invoice.status === "REJECTED" && presentation.action === "USER_ACTION_REQUIRED" ? <Link className="button secondary" href="/app/tomadores">Corrigir dados do tomador</Link> : null}</section>
  </div>;
}
