import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, StatusBadge, formatDateTime } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { getClientServiceStatusLabel, serviceWorkflowStatuses, type ServiceWorkflowStatus } from "@/lib/services/workflow";
import { createAdminClient } from "@/lib/supabase/admin";

type QueueService = {
  id: string;
  organization_id: string;
  name: string;
  default_description: string | null;
  client_service_location: string | null;
  workflow_status: ServiceWorkflowStatus;
  submitted_at: string | null;
  updated_at: string;
  organizations: { legal_name: string; municipality_code: string; state: string | null } | null;
};

function badgeTone(status: ServiceWorkflowStatus): "success" | "warning" | "info" | "neutral" {
  if (status === "REVIEWED") return "success";
  if (status === "NEEDS_INFO") return "warning";
  if (status === "PENDING_REVIEW") return "info";
  return "neutral";
}

export default async function ServiceValidationPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const filters = await searchParams;
  const validStatus = serviceWorkflowStatuses.includes(filters.status as ServiceWorkflowStatus) ? filters.status as ServiceWorkflowStatus : null;
  let query = createAdminClient().from("service_templates")
    .select("id,organization_id,name,default_description,client_service_location,workflow_status,submitted_at,updated_at,organizations(legal_name,municipality_code,state)")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(500);
  if (validStatus) query = query.eq("workflow_status", validStatus);
  const { data } = await query;
  const normalized = (data ?? []).map((item) => ({ ...item, organizations: item.organizations?.[0] ?? null })) as QueueService[];
  const needle = filters.q?.trim().toLocaleLowerCase("pt-BR");
  const services = needle ? normalized.filter((item) => `${item.name} ${item.default_description ?? ""} ${item.organizations?.legal_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)) : normalized;
  const pendingCount = normalized.filter((item) => item.workflow_status === "PENDING_REVIEW").length;
  const needsInfoCount = normalized.filter((item) => item.workflow_status === "NEEDS_INFO").length;

  return <div className="page v2-page">
    <PageHeader title="Validação de serviços" description="Analise o que os clientes prestam e complete a configuração fiscal antes da emissão." />
    <div className="v2-service-queue-summary"><span><strong>{pendingCount}</strong>Aguardando análise</span><span><strong>{needsInfoCount}</strong>Precisam de informação</span></div>
    <form className="v2-filterbar compact" method="get">
      <label className="v2-search"><Search size={17} aria-hidden /><span className="sr-only">Buscar serviço</span><input name="q" defaultValue={filters.q} placeholder="Buscar empresa, serviço ou descrição" /></label>
      <select name="status" defaultValue={validStatus ?? ""} aria-label="Filtrar status"><option value="">Todos os status</option><option value="PENDING_REVIEW">Aguardando análise</option><option value="NEEDS_INFO">Precisa de informação</option><option value="DRAFT">Rascunho</option><option value="REVIEWED">Revisado</option><option value="INACTIVE">Inativo</option></select>
      <button className="button secondary" type="submit">Filtrar</button>
    </form>
    <section className="v2-panel v2-table-panel">
      <div className="v2-panel-heading"><div><h2>Fila operacional</h2><p>{services.length} resultado(s)</p></div></div>
      {services.length ? <div className="v2-table-scroll"><table className="v2-table v2-service-queue-table"><thead><tr><th>Empresa</th><th>Serviço</th><th>Município</th><th>Status</th><th>Enviado em</th><th>Ação</th></tr></thead><tbody>{services.map((service) => <tr key={service.id}>
        <td><Link className="v2-table-primary" href={`/admin/empresas/${service.organization_id}?tab=services&service=${service.id}`}>{service.organizations?.legal_name ?? "Empresa indisponível"}</Link></td>
        <td><strong>{service.name}</strong><small>{service.default_description ?? "Sem descrição comercial."}</small></td>
        <td>{service.client_service_location ?? `Município da empresa${service.organizations?.state ? ` / ${service.organizations.state}` : ""}`}</td>
        <td><StatusBadge tone={badgeTone(service.workflow_status)}>{getClientServiceStatusLabel(service.workflow_status)}</StatusBadge></td>
        <td>{formatDateTime(service.submitted_at ?? service.updated_at)}</td>
        <td><Link className="button ghost compact" href={`/admin/empresas/${service.organization_id}?tab=services&service=${service.id}`}><BriefcaseBusiness size={16} />{service.workflow_status === "PENDING_REVIEW" || service.workflow_status === "NEEDS_INFO" ? "Analisar" : "Abrir"}<ArrowRight size={15} /></Link></td>
      </tr>)}</tbody></table></div> : <EmptyState title="Nenhum serviço nesta fila" description="Altere os filtros ou aguarde um novo envio do cliente." />}
    </section>
  </div>;
}
