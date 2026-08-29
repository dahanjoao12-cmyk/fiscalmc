import { redirect } from "next/navigation";
import { EmptyState, PageHeader, formatDateTime } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ organization?: string; action?: string; from?: string; to?: string }> }) {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const filters = await searchParams; const db = createAdminClient();
  const [{ data: organizations }, initial] = await Promise.all([db.from("organizations").select("id,legal_name").order("legal_name"), db.from("audit_logs").select("id,action,entity,actor_type,actor_user_id,created_at,safe_metadata,organizations(legal_name)").order("created_at", { ascending: false }).limit(200)]);
  let query = db.from("audit_logs").select("id,action,entity,actor_type,actor_user_id,created_at,safe_metadata,organizations(legal_name)").order("created_at", { ascending: false }).limit(200);
  if (filters.organization) query = query.eq("organization_id", filters.organization);
  if (filters.action?.trim()) query = query.ilike("action", `%${filters.action.trim()}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const data = filters.organization || filters.action || filters.from || filters.to ? (await query).data : initial.data;
  return <div className="page v2-page"><PageHeader title="Logs" description="Histórico seguro de ações administrativas e operacionais." /><form className="v2-filterbar compact" method="get"><select name="organization" aria-label="Empresa" defaultValue={filters.organization ?? ""}><option value="">Todas as empresas</option>{(organizations ?? []).map((organization) => <option key={organization.id} value={organization.id}>{organization.legal_name}</option>)}</select><input name="action" defaultValue={filters.action} placeholder="Evento ou categoria" aria-label="Evento" /><input name="from" defaultValue={filters.from} type="date" aria-label="Data inicial" /><input name="to" defaultValue={filters.to} type="date" aria-label="Data final" /><button className="button secondary" type="submit">Filtrar</button></form><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Hora</th><th>Empresa</th><th>Ação</th><th>Ator</th><th>Resultado</th><th>Detalhes</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td>{formatDateTime(item.created_at)}</td><td>{item.organizations?.[0]?.legal_name ?? "Operação global"}</td><td className="v2-table-primary">{humanize(item.action)}</td><td>{item.actor_type === "CLIENT" ? "Cliente" : item.actor_type === "OFFICE" ? "Escritório" : item.actor_type === "SYSTEM" ? "Sistema" : "Não informado"}</td><td>{item.entity}</td><td><details className="v2-log-details"><summary>Ver</summary><pre>{JSON.stringify(item.safe_metadata ?? {}, null, 2)}</pre></details></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum evento registrado" />}</section></div>;
}
