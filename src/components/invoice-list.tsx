import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { invoices } from "@/lib/mock-data";

export function InvoiceList({ all = false }: { all?: boolean }) {
  const rows = all ? invoices : invoices.slice(0, 4);
  return <section className="section"><h2 className="section-title">Notas recentes</h2><div className="row header"><span>Nº da nota</span><span>Tomador</span><span>Serviço</span><span>Valor</span><span>Status</span><span>Data de emissão</span><span /></div>{rows.map((invoice) => <Link href={`/app/notas/${invoice.id}`} className="row" key={invoice.id}><span>{invoice.id}</span><strong>{invoice.customer}</strong><span>{invoice.service}</span><span>{invoice.amount}</span><span className="status">{invoice.status}</span><span>{invoice.date}</span><ChevronRight size={17} aria-hidden /></Link>)}{!all && <div className="section-footer"><Link href="/app/notas">Ver todas as notas fiscais →</Link></div>}</section>;
}
