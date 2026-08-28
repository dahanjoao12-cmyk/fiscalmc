"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessageSquareWarning, Pencil, Plus, Search, X } from "lucide-react";
import { getServiceReadiness, getServiceTechnicalReadiness } from "@/lib/nfse/service-readiness";
import { getClientServiceStatusLabel, type ServiceWorkflowStatus } from "@/lib/services/workflow";
import { StatusBadge, formatDateTime } from "@/components/ui-kit";

export type ManagedService = {
  id: string;
  name: string;
  default_description: string | null;
  active: boolean;
  workflow_status: ServiceWorkflowStatus;
  created_via: "CLIENT" | "OFFICE";
  client_note: string | null;
  client_service_location: string | null;
  needs_info_message: string | null;
  submitted_at: string | null;
  review_note: string | null;
  updated_at: string;
  national_service_code_id: string | null;
  national_tax_code: string | null;
  municipal_service_code: string | null;
  municipal_service_mapping_id: string | null;
  dps_municipal_tax_code: string | null;
  dps_municipal_tax_code_source: string | null;
  service_location_municipality_code: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  national_service_codes: { display_code: string; description: string } | null;
};
type Code = { id: string; code: string; display_code: string; item: string; subitem: string | null; national_split: string | null; description: string };
type Mapping = { id: string; municipal_service_code: string; valid_from: string | null; valid_until: string | null; source: string; source_version: string | null };
type FormState = { name: string; defaultDescription: string; municipalServiceMappingId: string | null; dpsMunicipalTaxCode: string; dpsMunicipalTaxCodeSource: string; serviceLocationMunicipalityCode: string; reviewNote: string };
const blank: FormState = { name: "", defaultDescription: "", municipalServiceMappingId: null, dpsMunicipalTaxCode: "", dpsMunicipalTaxCodeSource: "", serviceLocationMunicipalityCode: "", reviewNote: "" };

function statusTone(status: ServiceWorkflowStatus): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "REVIEWED") return "success";
  if (status === "NEEDS_INFO") return "warning";
  if (status === "PENDING_REVIEW") return "info";
  return status === "INACTIVE" ? "neutral" : "neutral";
}

export function ServiceManager({ organizationId, municipalityCode, initialServices, catalogAvailable, initialSelectedServiceId }: { organizationId: string; municipalityCode: string; initialServices: ManagedService[]; catalogAvailable: boolean; initialSelectedServiceId?: string | null }) {
  const [services, setServices] = useState(initialServices);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [codes, setCodes] = useState<Code[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [selected, setSelected] = useState<Code | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [infoMessage, setInfoMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = services.find((service) => service.id === editingId) ?? null;
  const selectedMapping = mappings.find((mapping) => mapping.id === form.municipalServiceMappingId) ?? null;
  const canApproveCurrent = Boolean(current && current.workflow_status !== "INACTIVE" && (current.workflow_status === "PENDING_REVIEW" || (current.created_via === "OFFICE" && current.workflow_status === "DRAFT")));
  const hasUnsavedConfiguration = current ? selected?.id !== current.national_service_code_id
    || form.name.trim() !== current.name
    || (form.defaultDescription.trim() || null) !== (current.default_description?.trim() || null)
    || form.municipalServiceMappingId !== current.municipal_service_mapping_id
    || (form.dpsMunicipalTaxCode.trim() || null) !== current.dps_municipal_tax_code
    || (form.dpsMunicipalTaxCodeSource.trim() || null) !== current.dps_municipal_tax_code_source
    || (form.serviceLocationMunicipalityCode.trim() || null) !== current.service_location_municipality_code
    || (form.reviewNote.trim() || null) !== (current.review_note?.trim() || null) : true;
  const technical = useMemo(() => getServiceTechnicalReadiness({
    active: current?.active ?? false,
    workflow_status: current?.workflow_status ?? "DRAFT",
    national_service_code_id: selected?.id ?? null,
    national_tax_code: selected?.code ?? null,
    municipal_service_code: selectedMapping?.municipal_service_code ?? current?.municipal_service_code ?? null,
    municipal_service_mapping_id: form.municipalServiceMappingId,
    dps_municipal_tax_code: form.dpsMunicipalTaxCode || null,
    dps_municipal_tax_code_source: form.dpsMunicipalTaxCodeSource || null,
    service_location_municipality_code: form.serviceLocationMunicipalityCode || null,
    reviewed_at: current?.reviewed_at ?? null,
    reviewed_by: current?.reviewed_by ?? null,
  }), [current, form, selected, selectedMapping]);

  useEffect(() => {
    if (!open || !catalogAvailable || selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => fetch(`/api/admin/national-service-codes?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((response) => response.json()).then((result) => setCodes(result.codes ?? [])).catch(() => setError("Não foi possível pesquisar o catálogo.")), 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query, catalogAvailable, selected]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/admin/municipal-service-mappings?municipalityCode=${encodeURIComponent(municipalityCode)}&nationalServiceCodeId=${encodeURIComponent(selected.id)}`, { signal: controller.signal })
      .then((response) => response.json()).then((result) => setMappings(result.mappings ?? []))
      .catch(() => setError("Não foi possível carregar os de/para municipais."))
      .finally(() => setMappingLoading(false));
    return () => controller.abort();
  }, [selected, municipalityCode]);

  useEffect(() => {
    if (!initialSelectedServiceId) return;
    const service = initialServices.find((item) => item.id === initialSelectedServiceId);
    if (service) openForEdit(service);
    // The route-provided selection is only consumed on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() { setOpen(false); setEditingId(null); setSelected(null); setMappings([]); setMappingLoading(false); setForm(blank); setInfoMessage(""); setError(""); }
  function selectCode(code: Code) { setMappings([]); setMappingLoading(true); setSelected(code); setForm((value) => ({ ...value, municipalServiceMappingId: null, name: value.name || code.description.slice(0, 120) })); }
  function openForCreate() { setEditingId(null); setSelected(null); setForm({ ...blank, serviceLocationMunicipalityCode: municipalityCode }); setOpen(true); }
  function openForEdit(service: ManagedService) {
    setMappings([]);
    setEditingId(service.id);
    const code = service.national_service_code_id && service.national_tax_code ? { id: service.national_service_code_id, code: service.national_tax_code, display_code: service.national_service_codes?.display_code ?? service.national_tax_code, item: "", subitem: null, national_split: null, description: service.national_service_codes?.description ?? "Código nacional" } : null;
    setMappingLoading(Boolean(code));
    setSelected(code);
    setForm({ name: service.name, defaultDescription: service.default_description ?? "", municipalServiceMappingId: service.municipal_service_mapping_id, dpsMunicipalTaxCode: service.dps_municipal_tax_code ?? "", dpsMunicipalTaxCodeSource: service.dps_municipal_tax_code_source ?? "", serviceLocationMunicipalityCode: service.service_location_municipality_code ?? (service.client_service_location ? "" : municipalityCode), reviewNote: service.review_note ?? "" });
    setInfoMessage(service.needs_info_message ?? "");
    setOpen(true);
  }

  async function loadServices() {
    const response = await fetch(`/api/admin/organizations/${organizationId}/services`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar a lista de serviços.");
    const rows = (result.services ?? []).map((service: ManagedService & { national_service_codes: ManagedService["national_service_codes"] | ManagedService["national_service_codes"][] }) => ({
      ...service,
      national_service_codes: Array.isArray(service.national_service_codes) ? service.national_service_codes[0] ?? null : service.national_service_codes,
    })) as ManagedService[];
    setServices(rows);
    return rows;
  }

  async function save() {
    if (!selected || form.name.trim().length < 2) return;
    setSaving(true); setError("");
    const body = editingId ? { action: "update", id: editingId, nationalServiceCodeId: selected.id, ...form } : { nationalServiceCodeId: selected.id, ...form };
    const response = await fetch(`/api/admin/organizations/${organizationId}/services`, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error ?? "Não foi possível salvar o serviço."); return; }
    try {
      const rows = await loadServices();
      const updated = editingId ? rows.find((service) => service.id === editingId) : null;
      if (updated) openForEdit(updated); else close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Serviço salvo, mas a lista não pôde ser atualizada.");
    }
  }

  async function setActive(service: ManagedService, active: boolean) {
    const response = await fetch(`/api/admin/organizations/${organizationId}/services`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-active", id: service.id, active }) });
    const result = await response.json();
    if (response.ok) setServices((rows) => rows.map((row) => row.id === service.id ? { ...row, active, workflow_status: result.workflowStatus } : row));
    else setError(result.error ?? "Não foi possível alterar o status do serviço.");
  }

  async function review(action: "approve" | "request-info") {
    if (!current) return;
    setSaving(true); setError("");
    const response = await fetch(`/api/admin/organizations/${organizationId}/services/${current.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "approve" ? { action } : { action, message: infoMessage }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.missing?.length ? `${result.error} ${result.missing.join(", ")}.` : result.error ?? "Não foi possível concluir a análise."); return; }
    try { await loadServices(); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Análise concluída, mas a lista não pôde ser atualizada."); }
  }

  return <section className="section service-workflow-section">
    <div className="section-toolbar"><div><h2 className="section-title">Serviços da empresa</h2><p>O cliente informa a operação; o escritório classifica e aprova a parte fiscal.</p></div><button className="button primary" type="button" onClick={openForCreate} disabled={!catalogAvailable}><Plus size={18} />Adicionar serviço</button></div>
    {error && !open ? <p className="alert error">{error}</p> : null}
    {!catalogAvailable ? <div className="empty-state"><strong>Catálogo nacional ainda não foi importado.</strong><p>Importe a fonte oficial antes de classificar serviços.</p></div> : services.length ? <div className="service-list">{services.map((service) => {
      const readiness = getServiceReadiness(service);
      return <div className="service-row service-card" key={service.id}><div><strong>{service.name}</strong><span>{service.created_via === "CLIENT" ? "Enviado pelo cliente" : "Criado pelo escritório"} · atualizado em {formatDateTime(service.updated_at)}</span><small>{service.default_description || "Sem descrição comercial."}</small></div><div className="service-status"><StatusBadge tone={statusTone(service.workflow_status)}>{getClientServiceStatusLabel(service.workflow_status)}</StatusBadge>{service.workflow_status === "REVIEWED" ? <small>{readiness.ready ? "Apto para emissão" : "Readiness incompleto"}</small> : null}</div><div className="service-actions"><button className="button ghost" type="button" onClick={() => openForEdit(service)}><Pencil size={16} />{service.workflow_status === "PENDING_REVIEW" || service.workflow_status === "NEEDS_INFO" ? "Analisar" : "Editar"}</button>{service.workflow_status !== "INACTIVE" ? <button className="button ghost" type="button" onClick={() => setActive(service, false)}>Desativar</button> : <button className="button ghost" type="button" onClick={() => setActive(service, true)}>Reativar</button>}</div></div>;
    })}</div> : <div className="empty-state"><strong>Nenhum serviço configurado.</strong><p>O cliente pode enviar o primeiro serviço ou o escritório pode criá-lo em nome da empresa.</p></div>}

    {open ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingId ? "Analisar serviço" : "Adicionar serviço"}><div className="modal service-analysis-modal"><div className="modal-header"><div><h2>{editingId ? "Analisar serviço" : "Adicionar serviço"}</h2><p>Dados comerciais e classificação fiscal permanecem claramente separados.</p></div><button className="icon-button" type="button" onClick={close} aria-label="Fechar"><X /></button></div>
      <div className="service-analysis-scroll">
        <section className="service-analysis-block"><h3>Informações do cliente</h3>{current ? <p className="service-origin">{current.created_via === "CLIENT" ? "Enviado pelo cliente" : "Criado pelo escritório"} · {getClientServiceStatusLabel(current.workflow_status)}</p> : null}<div className="form-grid"><label>Nome do serviço<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Município técnico da prestação<input value={form.serviceLocationMunicipalityCode} onChange={(event) => setForm({ ...form, serviceLocationMunicipalityCode: event.target.value })} placeholder="Código IBGE validado" /></label><label className="full">Descrição padrão<textarea value={form.defaultDescription} onChange={(event) => setForm({ ...form, defaultDescription: event.target.value })} /></label></div>{current ? <div className="client-note"><strong>Local informado pelo cliente</strong><p>{current.client_service_location ?? "Município cadastrado da empresa"}</p></div> : null}{current?.client_note ? <div className="client-note"><strong>Observação para o escritório</strong><p>{current.client_note}</p></div> : null}</section>
        <section className="service-analysis-block"><h3>Configuração fiscal</h3>{!selected ? <><label className="search-field"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código ou descrição no catálogo nacional" /></label><div className="catalog-results">{codes.map((code) => <button className="catalog-option" type="button" key={code.id} onClick={() => selectCode(code)}><span className="catalog-code">{code.display_code}</span><span>{code.description}</span><b>Selecionar</b></button>)}{!codes.length ? <p>Nenhum código encontrado.</p> : null}</div></> : <div className="service-form"><button className="text-button" type="button" onClick={() => { setSelected(null); setMappings([]); setMappingLoading(false); setForm((value) => ({ ...value, municipalServiceMappingId: null })); }}>Alterar código nacional</button><div className="selected-code"><strong>{selected.display_code}</strong><span>{selected.description}</span></div><fieldset><legend>De/para municipal</legend>{mappingLoading ? <p>Buscando mapeamentos disponíveis…</p> : mappings.length ? <>{mappings.map((mapping) => <label className="mapping-option" key={mapping.id}><input type="radio" name="municipal-mapping" checked={form.municipalServiceMappingId === mapping.id} onChange={() => setForm({ ...form, municipalServiceMappingId: mapping.id })} /><span><strong>{mapping.municipal_service_code}</strong><small>Vigência: {mapping.valid_from ?? "não informada"} até {mapping.valid_until ?? "atual"} · {mapping.source}{mapping.source_version ? ` ${mapping.source_version}` : ""}</small></span></label>)}<button className="text-button" type="button" onClick={() => setForm({ ...form, municipalServiceMappingId: null })}>Manter sem de/para por enquanto</button></> : <p className="alert">Não encontramos parametrização municipal vigente para este serviço. Ele não poderá ser aprovado.</p>}</fieldset><label>Código DPS municipal <em>3 dígitos, confirmado pelo escritório</em><input placeholder="000" value={form.dpsMunicipalTaxCode} onChange={(event) => setForm({ ...form, dpsMunicipalTaxCode: event.target.value })} /></label><label>Fonte do código DPS municipal<input placeholder="Documento, versão ou referência oficial" value={form.dpsMunicipalTaxCodeSource} onChange={(event) => setForm({ ...form, dpsMunicipalTaxCodeSource: event.target.value })} /></label><label>Nota interna da revisão<textarea value={form.reviewNote} onChange={(event) => setForm({ ...form, reviewNote: event.target.value })} /></label>{selectedMapping ? <p className="alert">Código municipal selecionado: {selectedMapping.municipal_service_code}. O código DPS permanece independente.</p> : null}</div>}
          <div className="readiness-missing"><strong>Campos obrigatórios para aprovação</strong>{technical.ready ? <p className="success-text"><CheckCircle2 size={16} />Configuração técnica completa.</p> : <ul>{technical.missing.map((field) => <li key={field}>{field}</li>)}</ul>}</div>
        </section>
        {current?.workflow_status === "PENDING_REVIEW" ? <section className="service-analysis-block request-info-block"><h3>Solicitar informação</h3><label>Mensagem para o cliente<textarea value={infoMessage} onChange={(event) => setInfoMessage(event.target.value)} placeholder="Explique de forma simples o que precisa ser confirmado." /></label><button className="button secondary" type="button" disabled={infoMessage.trim().length < 10 || saving} onClick={() => review("request-info")}><MessageSquareWarning size={17} />Solicitar informação</button></section> : null}
        {error ? <p className="alert error">{error}</p> : null}
      </div>
      <div className="form-actions service-analysis-actions"><button className="button secondary" type="button" onClick={close}>Cancelar</button><button className="button secondary" type="button" disabled={!selected || saving || !hasUnsavedConfiguration} onClick={save}>{saving ? "Salvando…" : "Salvar configuração"}</button>{canApproveCurrent ? <button className="button primary" type="button" disabled={!technical.ready || saving || hasUnsavedConfiguration} onClick={() => review("approve")} title={hasUnsavedConfiguration ? "Salve a configuração antes de aprovar." : undefined}><CheckCircle2 size={17} />{hasUnsavedConfiguration ? "Salve antes de aprovar" : "Aprovar serviço"}</button> : null}</div>
    </div></div> : null}
  </section>;
}
