import { redirect } from "next/navigation";
import { EmptyState, PageHeader, formatDateTime } from "@/components/ui-kit";
import { requireOfficeDataClient } from "@/lib/auth/session";
import { presentAuditActor, presentAuditEvent } from "@/lib/operations/audit-presentation";


export default async function LogsPage({ searchParams }: { searchParams: Promise<{ organization?: string; action?: string; from?: string; to?: string }> }) {
  const db = await requireOfficeDataClient().catch(() => null);
  if (!db) redirect("/app?notice=office");
  const filters = await searchParams;
  const [{ data: organizations }, initial] = await Promise.all([db.from("organizations").select("id,legal_name").order("legal_name"), db.from("audit_logs").select("id,action,entity,actor_type,actor_user_id,created_at,safe_metadata,organizations(legal_name)").order("created_at", { ascending: false }).limit(200)]);
  let query = db.from("audit_logs").select("id,action,entity,actor_type,actor_user_id,created_at,safe_metadata,organizations(legal_name)").order("created_at", { ascending: false }).limit(200);
  if (filters.organization) query = query.eq("organization_id", filters.organization);
  if (filters.action?.trim()) query = query.ilike("action", `%${filters.action.trim()}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const data = filters.organization || filters.action || filters.from || filters.to ? (await query).data : initial.data;
  return <div className="page v2-page"><PageHeader title="Histórico operacional" description="Acompanhe o que aconteceu nas empresas atendidas." /><form className="v2-filterbar compact" method="get"><select name="organization" aria-label="Empresa" defaultValue={filters.organization ?? ""}><option value="">Todas as empresas</option>{(organizations ?? []).map((organization) => <option key={organization.id} value={organization.id}>{organization.legal_name}</option>)}</select><input name="action" defaultValue={filters.action} placeholder="Buscar no histórico" aria-label="Evento" /><input name="from" defaultValue={filters.from} type="date" aria-label="Data inicial" /><input name="to" defaultValue={filters.to} type="date" aria-label="Data final" /><button className="button secondary" type="submit">Filtrar</button></form><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Data e hora</th><th>Empresa</th><th>O que aconteceu</th><th>Responsável</th><th>Área</th></tr></thead><tbody>{data.map((item) => { const event=presentAuditEvent(item.action); const org=Array.isArray(item.organizations)?item.organizations[0]:item.organizations; return <tr key={item.id}><td>{formatDateTime(item.created_at)}</td><td>{org?.legal_name ?? "Operação geral"}</td><td className="v2-table-primary">{event.label}</td><td>{presentAuditActor(item.actor_type)}</td><td>{event.area}</td></tr>; })}</tbody></table></div> : <EmptyState title="Nenhum evento registrado" />}</section></div>;
}
