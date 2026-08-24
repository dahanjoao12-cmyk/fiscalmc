import Link from "next/link";
import { AlertTriangle, Building2, CircleX, Clock3, FileCheck2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MockBanner } from "@/components/mock-banner";

const attentions = [
  ["Papelaria Horizonte", "Certificado vence em 12 dias"],
  ["Clínica Boa Vida", "Configuração fiscal incompleta"],
  ["Studio Norte", "Emissão com resultado incerto"],
];

const recentActivity = [
  "Nota fiscal emitida por Construtora Alpha Ltda",
  "Emissão rejeitada para Design & Arte Ltda",
  "Empresa Clínica Boa Vida atualizada",
];

export const metadata = { title: "Administração" };

export default function AdminPage() {
  return (
    <AppShell active="home" admin>
      <div className="page">
        <MockBanner />
        <div className="page-heading">
          <div>
            <h1>Visão geral</h1>
            <p>Acompanhe a operação fiscal das empresas.</p>
          </div>
          <Link href="/admin/empresas/nova" className="button primary" aria-label="Nova empresa">
            <Plus size={18} />
            <span>Nova empresa</span>
          </Link>
        </div>

        <div className="metrics admin-metrics">
          <AdminMetric icon={<Building2 />} label="Empresas ativas" value="24" />
          <AdminMetric icon={<FileCheck2 />} label="Notas emitidas hoje" value="18" />
          <AdminMetric icon={<CircleX />} label="Emissões rejeitadas" value="2" tone="error" />
          <AdminMetric icon={<Clock3 />} label="Em análise" value="1" tone="warning" />
        </div>

        <section className="section">
          <h2 className="section-title">Requer atenção</h2>
          {attentions.map(([company, message]) => (
            <div className="row attention-row" key={company}>
              <AlertTriangle size={19} color="var(--amber)" />
              <strong>{company}</strong>
              <span>{message}</span>
              <button className="button ghost">Analisar</button>
            </div>
          ))}
        </section>

        <section className="section activity-section">
          <h2 className="section-title">Atividade recente</h2>
          {recentActivity.map((item, index) => (
            <div className="row activity-row" key={item}>
              <span>{item}</span>
              <span>{index ? "Hoje, 09:15" : "Hoje, 11:42"}</span>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function AdminMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "error" | "warning" }) {
  const color = tone === "error" ? "var(--red)" : tone === "warning" ? "var(--amber)" : "var(--emerald-dark)";
  return (
    <div className="metric admin-metric">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value" style={{ color }}>{value}</div>
      </div>
      <span className="admin-metric-icon" style={{ color }}>{icon}</span>
    </div>
  );
}
