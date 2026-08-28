import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { InvoiceList, type InvoiceRow } from "@/components/invoice-list";
import { PageHeader } from "@/components/ui-kit";
import { requireClientPageSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InvoicesPage() {
  const session = await requireClientPageSession();
  const { data } = await createAdminClient().from("invoices").select("id,dps_number,nfse_number,amount_cents,status,service_date,created_at,updated_at,customers(legal_name),service_templates(name)").eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(100);
  const rows: InvoiceRow[] = (data ?? []).map((item) => ({ id: item.id, number: item.nfse_number ?? item.dps_number?.toString() ?? "Em confirmação", amountCents: item.amount_cents, status: item.status, date: item.service_date, createdAt: item.created_at, updatedAt: item.updated_at, customer: item.customers?.[0]?.legal_name ?? "Tomador não disponível", service: item.service_templates?.[0]?.name ?? "Serviço não disponível" }));
  return <div className="page v2-page"><PageHeader title="Notas" description="Consulte as emissões da sua empresa." actions={<Link className="button primary" href="/app/emitir"><FilePlus2 size={18} />Emitir NFS-e</Link>} /><InvoiceList all rows={rows} /></div>;
}
