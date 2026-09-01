"use client";

import Link from "next/link";
import { Check, Eye, FileCheck2, LoaderCircle, Send, UserPlus, WifiOff } from "lucide-react";
import { useState } from "react";
import { getInvoicePresentation } from "@/lib/invoices/presentation";

export type IssueCustomer = { id: string; legalName: string; taxId?: string | null };
export type IssueService = { id: string; name: string; defaultDescription?: string | null };
type Props = { customers: IssueCustomer[]; services: IssueService[]; mock?: boolean; issuanceOrganizationId?: string };
type Result = { status: "ISSUED" | "REJECTED" | "UNKNOWN"; invoiceId?: string; safeMessage: string };
const steps = ["Tomador", "Serviço", "Valores", "Revisão", "Emitir"];

export function IssueForm({ customers, services, mock = false, issuanceOrganizationId }: Props) {
  const [selectedCustomerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [selectedServiceTemplateId, setServiceId] = useState(services[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(services[0]?.defaultDescription ?? "");
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const customer = customers.find((item) => item.id === selectedCustomerId);
  const service = services.find((item) => item.id === selectedServiceTemplateId);
  const canPreview = Boolean(customer && service && amount && description.trim().length >= 3 && date);
  const activeStep = preview ? 4 : amount ? 3 : service ? 2 : customer ? 1 : 0;

  function changed(action: () => void) { action(); setPreview(false); setError(""); }
  async function issue() {
    if (!preview) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ ...(issuanceOrganizationId ? { organizationId: issuanceOrganizationId } : {}), customerId: selectedCustomerId, serviceTemplateId: selectedServiceTemplateId, amount: amount.replace(/\./g, "").replace(",", "."), serviceDate: date, description, ...(mock ? { scenario: "success" } : {}) }) });
      const payload = await response.json() as Result & { error?: string };
      if (payload.status === "REJECTED" || payload.status === "UNKNOWN" || payload.status === "ISSUED") {
        setResult(payload);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? payload.safeMessage ?? "Não foi possível concluir a emissão.");
      setResult(payload);
      setIdempotencyKey(crypto.randomUUID());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a emissão."); }
    finally { setSubmitting(false); }
  }

  if (result) {
    const presentation = getInvoicePresentation(result.status, result.safeMessage);
    const detailHref = result.invoiceId && !mock ? `/app/notas/${result.invoiceId}` : null;
    return <section className={`v2-result-panel is-${presentation.tone}`} role="status" aria-live="polite"><span><FileCheck2 size={25} aria-hidden /></span><div><h2>{presentation.title}</h2><p>{presentation.description}</p>{result.status === "ISSUED" ? <dl className="v2-result-summary"><div><dt>Tomador</dt><dd>{customer?.legalName ?? "—"}</dd></div><div><dt>Valor</dt><dd>{amount ? `R$ ${amount}` : "—"}</dd></div><div><dt>Data</dt><dd>{date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`)) : "—"}</dd></div></dl> : null}{result.status === "UNKNOWN" ? <p className="v2-result-note">Você pode sair desta tela. A nota continuará sendo acompanhada pelo sistema.</p> : null}<div className="v2-result-actions">{detailHref ? <Link className="button primary" href={detailHref}>Ver nota</Link> : null}{result.status === "UNKNOWN" && detailHref ? <Link className="button secondary" href={detailHref}>Acompanhar situação</Link> : null}{result.status !== "UNKNOWN" ? <button className="button secondary" type="button" onClick={() => { setResult(null); setPreview(false); setError(""); setIdempotencyKey(crypto.randomUUID()); }}>Emitir outra NFS-e</button> : null}</div></div></section>;
  }
  if (!services.length) return <section className="v2-empty v2-panel"><strong>Nenhum serviço está disponível para emissão.</strong><p>Entre em contato com o escritório para revisar os serviços fiscais.</p></section>;

  return <section className="v2-issue-flow">
    <ol className="v2-stepper" aria-label="Etapas da emissão">{steps.map((step, index) => <li className={index < activeStep ? "done" : index === activeStep ? "active" : ""} key={step}><span>{index < activeStep ? <Check size={14} /> : index + 1}</span><strong>{step}</strong></li>)}</ol>
    {error ? <div className="alert error v2-alert"><WifiOff size={17} />{error}</div> : null}
    <div className="v2-issue-layout">
      <form className="v2-issue-form" onSubmit={(event) => event.preventDefault()}>
        <section className="v2-form-section"><div className="v2-form-section-heading"><span>1</span><div><h2>Tomador</h2><p>Selecione quem receberá a nota fiscal.</p></div></div>
          {customers.length ? <label className="field"><span>Tomador do serviço</span><select className="input" id="customer" value={selectedCustomerId} onChange={(event) => changed(() => setCustomerId(event.target.value))}>{customers.map((item) => <option value={item.id} key={item.id}>{item.legalName}{item.taxId ? ` — ${item.taxId}` : ""}</option>)}</select></label> : <div className="v2-inline-empty"><div><strong>Nenhum tomador cadastrado.</strong><p>Cadastre um tomador sem perder os dados desta emissão.</p></div><Link className="button secondary" href="/app/tomadores"><UserPlus size={17} />Novo tomador</Link></div>}
        </section>
        <section className="v2-form-section"><div className="v2-form-section-heading"><span>2</span><div><h2>Serviço</h2><p>Escolha um serviço fiscal já revisado pelo escritório.</p></div></div>
          <label className="field"><span>Serviço prestado</span><select className="input" id="service" value={selectedServiceTemplateId} onChange={(event) => changed(() => { const next = services.find((item) => item.id === event.target.value); setServiceId(event.target.value); if (next?.defaultDescription && description === service?.defaultDescription) setDescription(next.defaultDescription); })}>{services.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Descrição do serviço</span><textarea className="input" id="description" value={description} maxLength={1000} onChange={(event) => changed(() => setDescription(event.target.value))} /></label>
        </section>
        <section className="v2-form-section"><div className="v2-form-section-heading"><span>3</span><div><h2>Valores</h2><p>Informe a competência e o valor total do serviço.</p></div></div>
          <div className="v2-form-grid"><label className="field"><span>Data da prestação</span><input className="input" id="date" type="date" value={date} onChange={(event) => changed(() => setDate(event.target.value))} /></label><label className="field"><span>Valor total</span><div className="money-input"><span>R$</span><input className="input" id="amount" inputMode="decimal" value={amount} placeholder="0,00" onChange={(event) => changed(() => setAmount(event.target.value))} /></div></label></div>
        </section>
        <div className="v2-issue-actions"><button className="button secondary" type="button" disabled={!canPreview || submitting} onClick={() => setPreview(true)}><Eye size={18} />Revisar emissão</button><button className="button primary" type="button" disabled={!preview || submitting || !customers.length} onClick={issue}>{submitting ? <><LoaderCircle className="spin" size={18} />Emitindo…</> : <><Send size={18} />Emitir NFS-e</>}</button></div>
      </form>
      <aside className="v2-issue-summary"><div className="v2-panel-heading"><div><h2>Resumo da emissão</h2><p>Confira os dados antes de emitir.</p></div></div><dl>
        <div><dt>Tomador</dt><dd>{customer?.legalName ?? "Selecione um tomador"}</dd></div>
        <div><dt>Serviço</dt><dd>{service?.name ?? "Selecione um serviço"}</dd></div>
        <div><dt>Data</dt><dd>{date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`)) : "—"}</dd></div>
        <div><dt>Descrição</dt><dd>{description || "—"}</dd></div>
        <div className="total"><dt>Valor total</dt><dd>{amount ? `R$ ${amount}` : "R$ 0,00"}</dd></div>
      </dl>{preview ? <p className="v2-review-ready"><Check size={16} />Dados revisados. A nota está pronta para envio.</p> : <p className="v2-summary-hint">Preencha os campos para avançar à revisão.</p>}</aside>
    </div>
  </section>;
}
