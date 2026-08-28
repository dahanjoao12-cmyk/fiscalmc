import Link from "next/link";
import { ArrowUpRight, FilePlus2 } from "lucide-react";
import { EmptyState, StatusBadge, formatCurrency, formatDate } from "./ui-kit";

export type InvoiceRow = { id: string; number: string; customer: string; service: string; amountCents: number; status: string; date: string; company?: string; createdAt?: string };
const clientLabels: Record<string, string> = { ISSUED: "Emitida", REJECTED: "Rejeitada", UNKNOWN: "Em confirmação", CANCELLED: "Cancelada", SUBMITTING: "Em análise", READY: "Em análise", DRAFT: "Em preparação" };
const adminLabels: Record<string, string> = { ...clientLabels, UNKNOWN: "Verificação necessária" };
function tone(status: string): "success" | "warning" | "danger" | "info" | "neutral" { if (status === "ISSUED") return "success"; if (status === "REJECTED" || status === "CANCELLED") return "danger"; if (status === "UNKNOWN") return "warning"; if (status === "READY" || status === "SUBMITTING") return "info"; return "neutral"; }

export function InvoiceList({ rows, all = false, admin = false }: { rows: InvoiceRow[]; all?: boolean; admin?: boolean }) {
  const visible = all ? rows : rows.slice(0, 5);
  const href = (id: string) => admin ? `/admin/notas/${id}` : `/app/notas/${id}`;
  const labels = admin ? adminLabels : clientLabels;
  return <section className="v2-panel v2-table-panel invoice-table-panel">
    <div className="v2-panel-heading"><div><h2>{all ? "Notas fiscais" : "Últimas notas"}</h2><p>{all ? "Histórico de emissões e tentativas." : "Movimentações mais recentes da empresa."}</p></div>{!all ? <Link className="v2-text-action" href={admin ? "/admin/notas" : "/app/notas"}>Ver todas</Link> : null}</div>
    {visible.length ? <div className="v2-table-scroll"><table className="v2-table"><thead><tr><th>Número</th>{admin ? <th>Empresa</th> : null}<th>Tomador</th><th>Serviço</th><th>Competência</th><th>Valor</th><th>Status</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{visible.map((invoice) => <tr key={invoice.id}><td className="v2-table-primary">{invoice.number}</td>{admin ? <td>{invoice.company ?? "—"}</td> : null}<td>{invoice.customer}</td><td>{invoice.service}</td><td>{formatDate(invoice.date)}</td><td>{formatCurrency(invoice.amountCents)}</td><td><StatusBadge tone={tone(invoice.status)}>{labels[invoice.status] ?? invoice.status}</StatusBadge></td><td><Link className="v2-icon-action" href={href(invoice.id)} title="Abrir nota"><ArrowUpRight size={17} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma nota encontrada" description="As emissões reais aparecerão aqui." action={!admin ? <Link className="button primary" href="/app/emitir"><FilePlus2 size={17} />Emitir NFS-e</Link> : undefined} />}
  </section>;
}
