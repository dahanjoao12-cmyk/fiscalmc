import Link from "next/link";
import { FileCheck2, FilePlus2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MockBanner } from "@/components/mock-banner";
import { InvoiceList } from "@/components/invoice-list";

export const metadata = { title: "Início" };
export default function DashboardPage() {
  return <AppShell active="home"><div className="page"><MockBanner/><div className="page-heading"><div><h1>Olá, João</h1><p>Aqui está o resumo das suas notas fiscais de serviço.</p></div><Link className="button primary" href="/app/emitir"><FilePlus2 size={20}/><span>Emitir NFS-e</span></Link></div><div className="metrics"><div className="metric"><div><div className="metric-label">Notas emitidas</div><div className="metric-value">12</div></div><span className="metric-icon"><FileCheck2/></span></div><div className="metric"><div><div className="metric-label">Total no mês</div><div className="metric-value">R$ 18.450,00</div></div><span className="metric-icon"><WalletCards/></span></div></div><InvoiceList/></div></AppShell>;
}
