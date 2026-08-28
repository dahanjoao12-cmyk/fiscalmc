import { redirect } from "next/navigation";
import { EmptyState, PageHeader, formatTaxId } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OfficeCustomersPage() {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const { data } = await createAdminClient().from("customers").select("id,legal_name,tax_id,municipality_code,state,organizations(legal_name)").order("legal_name").limit(200);
  return <div className="page v2-page"><PageHeader title="Tomadores" description="Tomadores cadastrados nas empresas atendidas." /><section className="v2-panel v2-table-panel">{data?.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Tomador</th><th>CPF/CNPJ</th><th>Empresa</th><th>Município</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td className="v2-table-primary">{item.legal_name}</td><td>{item.tax_id ? formatTaxId(item.tax_id) : "—"}</td><td>{item.organizations?.[0]?.legal_name ?? "—"}</td><td>{item.municipality_code ?? "—"}{item.state ? ` / ${item.state}` : ""}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum tomador cadastrado" description="Os tomadores aparecerão aqui quando forem cadastrados pelas empresas." />}</section></div>;
}
