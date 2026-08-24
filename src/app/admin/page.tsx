import Link from "next/link";
import { AlertTriangle, Building2, CircleX, Clock3, FileCheck2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MockBanner } from "@/components/mock-banner";

const attentions = [
  ["Papelaria Horizonte", "Certificado vence em 12 dias"],
  ["Clínica Boa Vida", "Configuração fiscal incompleta"],
  ["Studio Norte", "Emissão com resultado incerto"]
];

export const metadata = { title: "Administração" };
export default function AdminPage() { return <AppShell active="home" admin><div className="page"><MockBanner/><div className="page-heading"><div><h1>Visão geral</h1><p>Acompanhe a operação fiscal das empresas.</p></div><Link href="/admin/empresas/nova" className="button primary"><Plus size={18}/>Nova empresa</Link></div><div className="metrics" style={{ gridTemplateColumns:"repeat(4,minmax(0,1fr))" }}><AdminMetric icon={<Building2/>} label="Empresas ativas" value="24"/><AdminMetric icon={<FileCheck2/>} label="Notas emitidas hoje" value="18"/><AdminMetric icon={<CircleX/>} label="Emissões rejeitadas" value="2" tone="error"/><AdminMetric icon={<Clock3/>} label="Em análise" value="1" tone="warning"/></div><section className="section"><h2 className="section-title">Requer atenção</h2>{attentions.map(([company,message]) => <div className="row" style={{ gridTemplateColumns:"32px 1fr 2fr auto" }} key={company}><AlertTriangle size={19} color="var(--amber)"/><strong>{company}</strong><span>{message}</span><button className="button ghost">Analisar</button></div>)}</section><section className="section" style={{ marginTop:28 }}><h2 className="section-title">Atividade recente</h2>{["Nota fiscal emitida por Construtora Alpha Ltda","Emissão rejeitada para Design & Arte Ltda","Empresa Clínica Boa Vida atualizada"].map((item,index) => <div className="row" style={{ gridTemplateColumns:"1fr auto" }} key={item}><span>{item}</span><span style={{ color:"var(--muted)" }}>{index ? "Hoje, 09:15" : "Hoje, 11:42"}</span></div>)}</section></div></AppShell>; }

function AdminMetric({ icon,label,value,tone }: { icon:React.ReactNode; label:string; value:string; tone?:"error"|"warning" }) { const color=tone === "error" ? "var(--red)" : tone === "warning" ? "var(--amber)" : "var(--emerald-dark)"; return <div className="metric" style={{ minHeight:112, padding:18 }}><div><div className="metric-label">{label}</div><div className="metric-value" style={{ color }}>{value}</div></div><span style={{ color }}>{icon}</span></div>; }
