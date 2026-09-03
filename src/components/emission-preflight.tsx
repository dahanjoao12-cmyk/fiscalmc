"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";

type PreflightResult = {
  readiness: { registration: boolean; fiscal: boolean; service: boolean; certificate: boolean; clientAccess: boolean; organization: boolean };
  validation: { dpsBuilt: boolean; unsignedXsd: boolean; xmldsig: boolean; signatureVerification: boolean; signedXsd: boolean; gzipBase64: boolean; payload: boolean; pAliqEmitted: boolean };
  target: { environment: string };
  transmissionAttempted: boolean;
  sequenceConsumed: boolean;
  invoiceCreated: boolean;
};
type XsdDiagnostic = { errorCount: number; errors: string[] };

const readinessLabels: Array<[keyof PreflightResult["readiness"], string]> = [
  ["registration", "Cadastro"],
  ["fiscal", "Fiscal"],
  ["service", "Serviço"],
  ["certificate", "Certificado"],
];
const validationLabels: Array<[keyof PreflightResult["validation"], string]> = [
  ["dpsBuilt", "DPS construída"],
  ["unsignedXsd", "XSD da DPS"],
  ["xmldsig", "XMLDSIG"],
  ["signatureVerification", "Assinatura verificada"],
  ["signedXsd", "XSD da DPS assinada"],
  ["gzipBase64", "GZip/Base64"],
  ["payload", "Payload"],
];

export function EmissionPreflight({ organizationId, canRun }: { organizationId: string; canRun: boolean }) {
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [xsdDiagnostic, setXsdDiagnostic] = useState<XsdDiagnostic | null>(null);
  const [running, setRunning] = useState(false);
  const [operation, setOperation] = useState({
    taxId: "",
    legalName: "",
    street: "",
    addressNumber: "",
    neighborhood: "",
    postalCode: "",
    municipalityCode: "",
    state: "",
    amount: "",
    competence: "",
    description: "",
  });

  function updateField(field: keyof typeof operation, value: string) {
    setOperation((current) => ({ ...current, [field]: value }));
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = operation.amount.replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
      setError("Informe o valor da operação de teste.");
      return;
    }
    setRunning(true);
    setError("");
    setErrorCode("");
    setXsdDiagnostic(null);
    setResult(null);
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/emission-preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            taxId: operation.taxId,
            legalName: operation.legalName,
            street: operation.street,
            addressNumber: operation.addressNumber,
            neighborhood: operation.neighborhood,
            postalCode: operation.postalCode,
            municipalityCode: operation.municipalityCode,
            state: operation.state,
          },
          amountCents: Math.round(Number(amount) * 100),
          competence: operation.competence,
          description: operation.description,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Não foi possível concluir a pré-validação.");
        setErrorCode(typeof data?.code === "string" ? data.code : "");
        setXsdDiagnostic(isXsdDiagnostic(data?.xsdDiagnostic) ? data.xsdDiagnostic : null);
        return;
      }
      setResult(data as PreflightResult);
    } catch {
      setError("Não foi possível concluir a pré-validação agora. Tente novamente.");
      setErrorCode("");
      setXsdDiagnostic(null);
    } finally {
      setRunning(false);
    }
  }

  if (!canRun) return null;
  return <section className="v2-panel emission-preflight">
    <div className="v2-panel-heading">
      <div>
        <p className="eyebrow">Pré-validação da emissão</p>
        <h2>Validar antes de transmitir</h2>
        <p>Monta e assina uma DPS de teste no servidor, sem criar nota, reservar sequência ou transmitir.</p>
      </div>
      <ShieldCheck size={22} aria-hidden="true" />
    </div>
    <form className="emission-preflight-form" onSubmit={run}>
      <p className="form-help full">Os dados são usados somente nesta validação autenticada e não criam uma nota.</p>
      <label>CNPJ do tomador<input value={operation.taxId} onChange={(event) => updateField("taxId", event.target.value)} inputMode="numeric" required /></label>
      <label>Razão social do tomador<input value={operation.legalName} onChange={(event) => updateField("legalName", event.target.value)} required /></label>
      <label>Logradouro<input value={operation.street} onChange={(event) => updateField("street", event.target.value)} required /></label>
      <label>Número<input value={operation.addressNumber} onChange={(event) => updateField("addressNumber", event.target.value)} required /></label>
      <label>Bairro<input value={operation.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} required /></label>
      <label>CEP<input value={operation.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} inputMode="numeric" required /></label>
      <label>Código IBGE do município<input value={operation.municipalityCode} onChange={(event) => updateField("municipalityCode", event.target.value)} inputMode="numeric" required /></label>
      <label>UF<input value={operation.state} onChange={(event) => updateField("state", event.target.value.toUpperCase())} maxLength={2} required /></label>
      <label>Valor (R$)<input value={operation.amount} onChange={(event) => updateField("amount", event.target.value)} inputMode="decimal" placeholder="0,00" required /></label>
      <label>Competência<input value={operation.competence} onChange={(event) => updateField("competence", event.target.value)} type="date" required /></label>
      <label className="full">Descrição<textarea value={operation.description} onChange={(event) => updateField("description", event.target.value)} rows={3} required /></label>
      <div className="full emission-preflight-actions"><button className="button secondary" type="submit" disabled={running}>
        {running ? <><LoaderCircle className="spin" size={17} />Pré-validando…</> : "Pré-validar emissão"}
      </button></div>
    </form>
    {error ? <div className="alert error" role="alert"><p>{error}{errorCode ? <><br />Código: <strong>{errorCode}</strong></> : null}</p>{xsdDiagnostic ? <div className="emission-preflight-xsd-errors"><strong>Erros XSD ({xsdDiagnostic.errorCount})</strong><ol>{xsdDiagnostic.errors.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol></div> : null}</div> : null}
    {result ? <div className="emission-preflight-result" aria-live="polite">
      <strong>Pré-validação concluída</strong>
      <div className="emission-preflight-grid">
        <div>{readinessLabels.map(([key, label]) => <StatusLine key={key} label={label} passed={result.readiness[key]} />)}</div>
        <div>{validationLabels.map(([key, label]) => <StatusLine key={key} label={label} passed={result.validation[key]} />)}</div>
      </div>
      <p>Ambiente alvo: <strong>Produção Restrita</strong></p>
      <p>Alíquota na DPS: <strong>{result.validation.pAliqEmitted ? "informada" : "não informada"}</strong></p>
      <p>Transmissão: <strong>NÃO EXECUTADA</strong></p>
    </div> : null}
  </section>;
}

function StatusLine({ label, passed }: { label: string; passed: boolean }) {
  return <span className={passed ? "is-pass" : "is-fail"}>{passed ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}{label}: {passed ? "PASS" : "FAIL"}</span>;
}

function isXsdDiagnostic(value: unknown): value is XsdDiagnostic {
  return Boolean(value && typeof value === "object" && "errorCount" in value && typeof value.errorCount === "number" && "errors" in value && Array.isArray(value.errors) && value.errors.every((entry) => typeof entry === "string"));
}
