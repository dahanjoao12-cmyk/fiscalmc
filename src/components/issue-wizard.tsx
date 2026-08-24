"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, WifiOff } from "lucide-react";
import { customers, services } from "@/lib/mock-data";

type Result = { status: "ISSUED" | "REJECTED" | "UNKNOWN"; invoiceId?: string; safeMessage: string };

export function IssueWizard() {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(services[1]);
  const [customer, setCustomer] = useState(customers[0]);
  const [amount, setAmount] = useState("1.500,00");
  const [date, setDate] = useState("2026-08-24");
  const [description, setDescription] = useState("Consultoria referente ao mês de agosto.");
  const [scenario, setScenario] = useState("success");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function issue() {
    if (!navigator.onLine) { setError("Você precisa estar conectado à internet para emitir uma NFS-e."); return; }
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/invoices", { method:"POST", headers:{ "Content-Type":"application/json", "Idempotency-Key":idempotencyKey }, body:JSON.stringify({ organizationId:"00000000-0000-4000-8000-000000000002", serviceTemplateId:"00000000-0000-4000-8000-000000000102", customerId:"00000000-0000-4000-8000-000000000201", amount: amount.replace(/\./g,"").replace(",","."), serviceDate:date, description, scenario }) });
      const payload = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(payload.error || payload.safeMessage || "Não foi possível emitir a nota.");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a emissão."); }
    finally { setSubmitting(false); }
  }

  if (result) return <section className="form-card" aria-live="polite"><div style={{ textAlign:"center", padding:"38px 0" }}><CheckCircle2 size={58} color="var(--emerald)"/><h2 style={{ color:"var(--navy)", fontSize:30 }}>{result.status === "ISSUED" ? "NFS-e emitida" : result.status === "UNKNOWN" ? "Emissão em análise" : "Emissão não concluída"}</h2><p style={{ color:"var(--muted)", lineHeight:1.6 }}>{result.safeMessage}</p>{result.invoiceId && <a className="button primary" href={`/app/notas/${result.invoiceId}`}>Visualizar nota</a>}</div></section>;

  return <section className="form-card">
    <div className="progress" aria-label={`Etapa ${step} de 4`}>{["Serviço","Tomador","Dados","Revisão"].map((label,index) => <div key={label} data-step={index < step - 1 ? "✓" : index + 1} className={`progress-step ${index < step - 1 ? "done" : index === step - 1 ? "active" : ""}`}>{label}</div>)}</div>
    {error && <div className="alert error"><WifiOff size={17} style={{ display:"inline", marginRight:8 }}/>{error}</div>}
    {step === 1 && <div><h2>Qual serviço você prestou?</h2><p style={{ color:"var(--muted)" }}>Escolha uma opção configurada pelo escritório.</p><div className="choice-list">{services.map(item => <label className={`choice ${service === item ? "selected" : ""}`} key={item}><input type="radio" name="service" checked={service === item} onChange={() => setService(item)}/><strong>{item}</strong></label>)}</div></div>}
    {step === 2 && <div><h2>Para quem foi o serviço?</h2><p style={{ color:"var(--muted)" }}>Selecione um tomador salvo ou cadastre um novo.</p><div className="field"><label htmlFor="customer-search">Pesquisar tomadores</label><input id="customer-search" className="input" type="search" placeholder="Nome, CPF ou CNPJ" /></div><div className="choice-list" style={{ marginTop:14 }}>{customers.map(item => <label className={`choice ${customer === item ? "selected" : ""}`} key={item}><input type="radio" name="customer" checked={customer === item} onChange={() => setCustomer(item)}/><strong>{item}</strong></label>)}</div><button className="button ghost" style={{ marginTop:10 }}><Plus size={18}/>Cadastrar novo tomador</button></div>}
    {step === 3 && <div><h2>Dados da operação</h2><p style={{ color:"var(--muted)" }}>Os dados fiscais são preenchidos pelo escritório.</p><div className="field"><label htmlFor="amount">Valor do serviço</label><input className="input" id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><div className="field"><label htmlFor="date">Data da prestação</label><input className="input" id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="field"><label htmlFor="description">Descrição</label><textarea className="input" id="description" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div></div>}
    {step === 4 && <div><h2>Revise antes de emitir</h2><p style={{ color:"var(--muted)" }}>Confirme os dados da operação. A configuração fiscal não pode ser alterada aqui.</p><dl className="human-summary"><div className="summary-row"><dt>Tomador</dt><dd>{customer}</dd></div><div className="summary-row"><dt>Serviço</dt><dd>{service}</dd></div><div className="summary-row"><dt>Valor</dt><dd>R$ {amount}</dd></div><div className="summary-row"><dt>Data</dt><dd>{date.split("-").reverse().join("/")}</dd></div><div className="summary-row"><dt>Descrição</dt><dd>{description}</dd></div></dl>{process.env.NODE_ENV !== "production" && <div className="field"><label htmlFor="scenario">Cenário do provedor mock</label><select id="scenario" className="input" value={scenario} onChange={(e) => setScenario(e.target.value)}><option value="success">Sucesso</option><option value="rejection">Rejeição</option><option value="timeout">Timeout / resultado incerto</option></select></div>}</div>}
    <div className="form-actions"><button className="button secondary" disabled={step === 1 || submitting} onClick={() => setStep(step - 1)}>Voltar</button>{step < 4 ? <button className="button primary" onClick={() => setStep(step + 1)}>{step === 3 ? "Revisar emissão" : "Continuar"}</button> : <button className="button primary" disabled={submitting} onClick={issue}>{submitting ? <><LoaderCircle size={18} className="animate-spin"/>Emitindo…</> : "Emitir NFS-e"}</button>}</div>
  </section>;
}
