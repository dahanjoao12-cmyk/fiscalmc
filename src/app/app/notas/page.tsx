import { AppShell } from "@/components/app-shell";
import { InvoiceList } from "@/components/invoice-list";
import { MockBanner } from "@/components/mock-banner";
export const metadata = { title: "Notas fiscais" };
export default function InvoicesPage() { return <AppShell active="invoices"><div className="page"><MockBanner/><div className="page-heading"><div><h1>Notas fiscais</h1><p>Consulte as emissões da sua empresa.</p></div></div><div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}><input className="input" style={{ width:220 }} type="search" placeholder="Buscar tomador"/><select className="input" style={{ width:170 }}><option>Todos os status</option><option>Emitida</option><option>Rejeitada</option><option>Em análise</option></select></div><InvoiceList all/></div></AppShell>; }
