import Link from "next/link";
import { FilePlus2, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { InvoiceList, type InvoiceRow } from "@/components/invoice-list";
import { PageHeader } from "@/components/ui-kit";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminInvoices({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const filters = await searchParams;
  let query = createAdminClient().from("invoices").select("id,dps_number,amount_cents,status,service_date,created_at,organizations(legal_name),customers(legal_name),service_templates(name)").order("created_at", { ascending: false }).limit(200);
  if (filters.status) query = query.eq("status", filters.status);
  const { data } = await query;
  let rows: InvoiceRow[] = (data ?? []).map((item) => ({ id: item.id, number: item.dps_number?.toString() ?? "—", amountCents: item.amount_cents, status: item.status, date: item.service_date, createdAt: item.created_at, company: item.organizations?.[0]?.legal_name ?? "Empresa não disponível", customer: item.customers?.[0]?.legal_name ?? "Tomador não disponível", service: item.service_templates?.[0]?.name ?? "Serviço não disponível" }));
  if (filters.q?.trim()) { const needle = filters.q.toLocaleLowerCase("pt-BR"); rows = rows.filter((row) => row.customer.toLocaleLowerCase("pt-BR").includes(needle) || row.company?.toLocaleLowerCase("pt-BR").includes(needle) || row.number.includes(needle)); }
  return <div className="page v2-page"><PageHeader title="Notas" description="Acompanhe as emissões de todas as empresas atendidas." actions={<Link className="button primary" href="/admin/emissoes"><FilePlus2 size={18} />Emitir NFS-e</Link>} />
    <form className="v2-filterbar compact" method="get"><label className="v2-search"><Search size={17} /><span className="sr-only">Buscar nota</span><input name="q" defaultValue={filters.q} placeholder="Buscar número, empresa ou tomador" /></label><select name="status" defaultValue={filters.status ?? ""}><option value="">Todos os status</option><option value="ISSUED">Emitidas</option><option value="REJECTED">Rejeitadas</option><option value="SUBMITTING">Em análise</option><option value="UNKNOWN">Verificação necessária</option><option value="CANCELLED">Canceladas</option></select><button className="button secondary" type="submit">Filtrar</button></form>
    <InvoiceList all admin rows={rows} />
  </div>;
}
