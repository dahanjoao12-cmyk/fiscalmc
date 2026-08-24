"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ClipboardCopy, Eye, LoaderCircle, Send, WifiOff } from "lucide-react";
import { customers, invoices, services } from "@/lib/mock-data";

type Result = { status: "ISSUED" | "REJECTED" | "UNKNOWN"; invoiceId?: string; safeMessage: string };

export function IssueForm() {
  const [service, setService] = useState(services[1]);
  const [customer, setCustomer] = useState(customers[0]);
  const [amount, setAmount] = useState("1.500,00");
  const [date, setDate] = useState("2026-08-24");
  const [description, setDescription] = useState("Consultoria referente ao mês de agosto.");
  const [scenario, setScenario] = useState("success");
  const [copyNotice, setCopyNotice] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const canPreview = Boolean(customer && service && date && amount.trim() && description.trim().length >= 3);

  function changeField(update: () => void) {
    update();
    setPreviewed(false);
    setCopyNotice("");
    setError("");
  }

  function copyPrevious(kind: "customer" | "latest") {
    const source = kind === "customer" ? invoices.find((invoice) => invoice.customer === customer) : invoices[0];
    if (!source) {
      setCopyNotice("Não há uma NFS-e anterior disponível para este tomador.");
      return;
    }

    setService(source.service);
    setAmount(source.amount.replace("R$ ", ""));
    setDescription(source.description);
    setPreviewed(false);
    setError("");
    setCopyNotice(
      kind === "customer"
        ? `Dados da última NFS-e de ${customer} copiados. Revise tudo antes de emitir.`
        : "Dados da última NFS-e emitida copiados. O tomador atual foi preservado; revise tudo antes de emitir.",
    );
  }

  async function issue() {
    if (!previewed) {
      setError("Pré-visualize os dados atualizados antes de emitir.");
      return;
    }
    if (!navigator.onLine) {
      setError("Você precisa estar conectado à internet para emitir uma NFS-e.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          organizationId: "00000000-0000-4000-8000-000000000002",
          serviceTemplateId: "00000000-0000-4000-8000-000000000102",
          customerId: "00000000-0000-4000-8000-000000000201",
          amount: amount.replace(/\./g, "").replace(",", "."),
          serviceDate: date,
          description,
          scenario,
        }),
      });
      const payload = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error || payload.safeMessage || "Não foi possível emitir a nota.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a emissão.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <IssueResult result={result} />;

  return (
    <section className="form-card issue-form">
      <div className="issue-guide">
        <strong>Preencha somente os dados desta nota</strong>
        <span>Regime tributário, códigos fiscais e alíquota do ISS já estão configurados pelo escritório.</span>
      </div>

      {error ? <div className="alert error" role="alert"><WifiOff size={17} aria-hidden />{error}</div> : null}
      {copyNotice ? <div className="copy-notice" role="status"><ClipboardCopy size={18} aria-hidden /><span>{copyNotice} Nenhuma nota foi emitida.</span></div> : null}

      <form onSubmit={(event) => event.preventDefault()}>
        <div className="issue-fields">
          <div className="field field-wide">
            <div className="field-heading">
              <label htmlFor="customer">Tomador</label>
              <Link href="/app/tomadores">Gerenciar tomadores</Link>
            </div>
            <select className="input" id="customer" value={customer} onChange={(event) => changeField(() => setCustomer(event.target.value))}>
              {customers.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="copy-actions field-wide" aria-label="Reutilizar dados de nota anterior">
            <button className="button secondary" type="button" onClick={() => copyPrevious("customer")}>
              <ClipboardCopy size={18} aria-hidden />Copiar última deste tomador
            </button>
            <button className="button secondary" type="button" onClick={() => copyPrevious("latest")}>
              <ClipboardCopy size={18} aria-hidden />Copiar última NFS-e emitida
            </button>
          </div>

          <div className="field">
            <label htmlFor="service">Atividade ou serviço prestado</label>
            <select className="input" id="service" value={service} onChange={(event) => changeField(() => setService(event.target.value))}>
              {services.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="date">Data desejada para emissão</label>
            <input className="input" id="date" type="date" value={date} onChange={(event) => changeField(() => setDate(event.target.value))} />
          </div>

          <div className="field field-wide">
            <label htmlFor="description">Discriminação do serviço</label>
            <textarea className="input" id="description" maxLength={1000} value={description} onChange={(event) => changeField(() => setDescription(event.target.value))} />
            <span className="field-hint">Use uma descrição clara. Você poderá revisá-la antes da transmissão.</span>
          </div>

          <div className="field">
            <label htmlFor="amount">Valor total da NFS-e</label>
            <div className="money-input"><span>R$</span><input className="input" id="amount" inputMode="decimal" value={amount} onChange={(event) => changeField(() => setAmount(event.target.value))} /></div>
          </div>
        </div>

        {process.env.NODE_ENV !== "production" ? (
          <div className="field mock-scenario">
            <label htmlFor="scenario">Cenário do provedor mock</label>
            <select id="scenario" className="input" value={scenario} onChange={(event) => setScenario(event.target.value)}>
              <option value="success">Sucesso</option>
              <option value="rejection">Rejeição</option>
              <option value="timeout">Timeout / resultado incerto</option>
            </select>
          </div>
        ) : null}

        {previewed ? <InvoicePreview customer={customer} service={service} amount={amount} date={date} description={description} /> : null}

        <div className="form-actions issue-actions">
          <button className="button secondary" type="button" disabled={!canPreview || submitting} onClick={() => { setPreviewed(true); setError(""); }}>
            <Eye size={18} aria-hidden />Pré-visualizar NFS-e
          </button>
          <button className="button primary" type="button" disabled={!previewed || submitting} onClick={issue}>
            {submitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden />Emitindo…</> : <><Send size={18} aria-hidden />Emitir NFS-e</>}
          </button>
        </div>
      </form>
    </section>
  );
}

function InvoicePreview({ customer, service, amount, date, description }: { customer: string; service: string; amount: string; date: string; description: string }) {
  return (
    <section className="preview-panel" aria-live="polite">
      <div><Eye size={20} aria-hidden /><h2>Pré-visualização da NFS-e</h2></div>
      <p>Confira os dados abaixo. A nota ainda não foi emitida.</p>
      <dl className="human-summary">
        <div className="summary-row"><dt>Tomador</dt><dd>{customer}</dd></div>
        <div className="summary-row"><dt>Serviço</dt><dd>{service}</dd></div>
        <div className="summary-row"><dt>Data</dt><dd>{date.split("-").reverse().join("/")}</dd></div>
        <div className="summary-row"><dt>Descrição</dt><dd>{description}</dd></div>
        <div className="summary-row"><dt>Valor total</dt><dd>R$ {amount}</dd></div>
      </dl>
    </section>
  );
}

function IssueResult({ result }: { result: Result }) {
  return (
    <section className="form-card" aria-live="polite">
      <div className="issue-result">
        <CheckCircle2 size={58} color="var(--emerald)" aria-hidden />
        <h2>{result.status === "ISSUED" ? "NFS-e emitida" : result.status === "UNKNOWN" ? "Emissão em análise" : "Emissão não concluída"}</h2>
        <p>{result.safeMessage}</p>
        {result.invoiceId ? <a className="button primary" href={`/app/notas/${result.invoiceId}`}>Visualizar nota</a> : null}
      </div>
    </section>
  );
}
