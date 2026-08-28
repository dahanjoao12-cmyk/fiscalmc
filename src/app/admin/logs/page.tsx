import { redirect } from "next/navigation";
import { EmptyState, PageHeader, formatDateTime } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function LogsPage() {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { data } = await createAdminClient().from("audit_logs").select("id,action,entity,created_at,organizations(legal_name)").order("created_at", { ascending: false }).limit(200);
  return <div className="page v2-page"><PageHeader title="Logs" description="Histórico seguro de ações administrativas e operacionais." /><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Data</th><th>Empresa</th><th>Ação</th><th>Entidade</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td>{formatDateTime(item.created_at)}</td><td>{item.organizations?.[0]?.legal_name ?? "Operação global"}</td><td className="v2-table-primary">{item.action.replaceAll("_", " ")}</td><td>{item.entity}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum evento registrado" />}</section></div>;
}
