import { AlertTriangle, Building2, FileText, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { InvoiceTimeline } from "@/components/invoice-timeline";
import { ReconcileInvoiceButton } from "@/components/reconcile-invoice-button";
import { PageHeader, StatusBadge, formatCurrency, formatDate, formatDateTime } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { getInvoicePresentation } from "@/lib/invoices/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: invoice }, { data: attempts }, { data: artifacts }] = await Promise.all([
    db.from("invoices").select("id,dps_number,dps_identifier,nfse_number,amount_cents,status,service_date,description,access_key,issued_at,created_at,updated_at,safe_status_message,last_reconciled_at,environment,created_by,organizations(legal_name,tax_id),customers(legal_name,tax_id),service_templates(name)").eq("id", id).maybeSingle(),
    db.from("invoice_attempts").select("id,request_id,status,safe_error_message,started_at,finished_at").eq("invoice_id", id).order("started_at", { ascending: false }),
    db.from("fiscal_artifacts").select("artifact_type,created_at").eq("invoice_id", id),
  ]);
  if (!invoice) notFound();
  const presentation = getInvoicePresentation(invoice.status, invoice.safe_status_message);
  const latestAttempt = attempts?.[0];
  const hasNfseXml = (artifacts ?? []).some((artifact) => artifact.artifact_type === "NFSE_XML");
  const hasDanfse = (artifacts ?? []).some((artifact) => artifact.artifact_type === "DANFSE_PDF");
  const title = invoice.nfse_number ? `NFS-e nº ${invoice.nfse_number}` : "Solicitação de NFS-e";
  return <div className="page v2-page invoice-document"><PageHeader backHref="/admin/notas" backLabel="Notas" title={title} description={`Competência ${formatDate(invoice.service_date)}`} actions={<StatusBadge tone={presentation.tone}>{invoice.status === "UNKNOWN" ? "Verificação necessária" : presentation.label}</StatusBadge>} />
    {invoice.status === "UNKNOWN" ? <section className="v2-status-callout is-warning"><AlertTriangle size={21} aria-hidden /><div><strong>Verificação necessária</strong><p>A transmissão pode ter sido recebida. A nota não será reenviada automaticamente.</p></div><ReconcileInvoiceButton invoiceId={invoice.id} /></section> : <section className={`v2-status-callout is-${presentation.tone}`}><AlertTriangle size={21} aria-hidden /><div><strong>{presentation.title}</strong><p>{presentation.description}</p></div></section>}
    <div className="v2-document-grid"><section className="v2-panel v2-document-section"><h2><Building2 size={19} aria-hidden />Prestador</h2><dl><div><dt>Empresa</dt><dd>{invoice.organizations?.[0]?.legal_name ?? "—"}</dd></div><div><dt>CNPJ</dt><dd>{invoice.organizations?.[0]?.tax_id ?? "—"}</dd></div></dl></section><section className="v2-panel v2-document-section"><h2><UserRound size={19} aria-hidden />Tomador</h2><dl><div><dt>Nome</dt><dd>{invoice.customers?.[0]?.legal_name ?? "—"}</dd></div><div><dt>CPF/CNPJ</dt><dd>{invoice.customers?.[0]?.tax_id ?? "—"}</dd></div></dl></section></div>
    <section className="v2-panel v2-document-section"><h2><FileText size={19} aria-hidden />Serviço e valores</h2><dl className="columns"><div><dt>Serviço</dt><dd>{invoice.service_templates?.[0]?.name ?? "—"}</dd></div><div><dt>Valor</dt><dd className="document-total">{formatCurrency(invoice.amount_cents)}</dd></div><div><dt>Ambiente</dt><dd>{invoice.environment === "PRODUCTION_RESTRICTED" ? "Produção restrita" : "Produção"}</dd></div><div className="span"><dt>Descrição</dt><dd>{invoice.description}</dd></div>{invoice.access_key ? <div className="span"><dt>Chave de acesso</dt><dd className="break-all">{invoice.access_key}</dd></div> : null}</dl></section>
    <InvoiceTimeline office createdAt={invoice.created_at} status={invoice.status} issuedAt={invoice.issued_at} updatedAt={invoice.updated_at} lastReconciledAt={invoice.last_reconciled_at} attempts={(attempts ?? []).map((attempt) => ({ id: attempt.id, status: attempt.status, safeMessage: attempt.safe_error_message, startedAt: attempt.started_at, finishedAt: attempt.finished_at }))} />
    {hasNfseXml || hasDanfse ? <section className="v2-panel v2-document-section"><h2>Documentos oficiais</h2><div className="v2-document-actions">{hasDanfse ? <a className="button secondary" href={`/api/admin/invoices/${invoice.id}/artifacts/DANFSE_PDF`}>Baixar DANFSe</a> : null}{hasNfseXml ? <a className="button secondary" href={`/api/admin/invoices/${invoice.id}/artifacts/NFSE_XML`}>Baixar XML autorizado</a> : null}</div></section> : null}
    <details className="v2-panel v2-technical-details"><summary>Informações técnicas</summary><dl><div><dt>Invoice ID</dt><dd className="break-all">{invoice.id}</dd></div><div><dt>Status interno</dt><dd>{invoice.status}</dd></div><div><dt>Criada em</dt><dd>{formatDateTime(invoice.created_at)}</dd></div><div><dt>Atualizada em</dt><dd>{formatDateTime(invoice.updated_at)}</dd></div>{invoice.last_reconciled_at ? <div><dt>Última reconciliação</dt><dd>{formatDateTime(invoice.last_reconciled_at)}</dd></div> : null}{invoice.dps_identifier ? <div><dt>Identificador DPS</dt><dd className="break-all">{invoice.dps_identifier}</dd></div> : null}{latestAttempt ? <><div><dt>Tentativa mais recente</dt><dd>{latestAttempt.status}</dd></div><div><dt>Request ID</dt><dd className="break-all">{latestAttempt.request_id}</dd></div></> : null}</dl></details>
  </div>;
}
