import Link from "next/link";
import { ArrowUpRight, Building2, Ellipsis, FilePlus2, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetricTile, PageHeader, StatusBadge, formatDateTime, formatTaxId } from "@/components/ui-kit";
import { getCertificateOperationalState } from "@/lib/operations/queue";

export default async function AdminPage() {
  try { await requireOfficeSession(); } catch { redirect("/app?notice=office"); }
  const db = createAdminClient();
  const month = new Date().toISOString().slice(0, 7);
  const [companiesResult, issuedResult, certificatesResult, accessResult, activityResult, unknownResult, servicesResult, cancellationsResult] = await Promise.all([
    db.from("organizations").select("id,legal_name,tax_id,municipality_code,state,status,emission_blocked,created_at").order("created_at", { ascending: false }),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("status", "ISSUED").gte("service_date", `${month}-01`),
    db.from("digital_certificates").select("organization_id,status,valid_until").is("replaced_at", null),
    db.from("client_accesses").select("organization_id,enabled"),
    db.from("invoices").select("organization_id,created_at").order("created_at", { ascending: false }).limit(500),
    db.from("invoices").select("id", { count: "exact", head: true }).eq("status", "UNKNOWN"),
    db.from("service_templates").select("id", { count: "exact", head: true }).in("workflow_status", ["PENDING_REVIEW", "NEEDS_INFO"]),
    db.from("cancellation_requests").select("id", { count: "exact", head: true }).in("status", ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "UNKNOWN"]),
  ]);
  const companies = companiesResult.data ?? [];
  const certificates = new Map((certificatesResult.data ?? []).map((item) => [item.organization_id, item]));
  const accesses = new Map((accessResult.data ?? []).map((item) => [item.organization_id, item]));
  const activity = new Map<string, string>();
  for (const item of activityResult.data ?? []) if (!activity.has(item.organization_id)) activity.set(item.organization_id, item.created_at);
  const active = companies.filter((item) => item.status === "ACTIVE").length;
  const ready = companies.filter((item) => item.status === "ACTIVE" && !item.emission_blocked).length;
  const pending = companies.filter((item) => item.emission_blocked || item.status !== "ACTIVE");
  const certificateAttention = (certificatesResult.data ?? []).filter((certificate) => getCertificateOperationalState({ status: certificate.status, validUntil: certificate.valid_until }));
  const inactiveAccesses = (accessResult.data ?? []).filter((access) => !access.enabled).length;

  return <div className="page v2-page">
    <PageHeader title="Visão geral" description="Acompanhe a operação fiscal das empresas e mantenha tudo em dia." actions={<>
      <Link href="/admin/emissoes" className="button primary"><FilePlus2 size={18} aria-hidden />Emitir NFS-e</Link>
      <Link href="/admin/empresas/nova" className="button secondary"><Plus size={18} aria-hidden />Nova empresa</Link>
    </>} />
    <section className="v2-metrics" aria-label="Indicadores do escritório">
      <MetricTile label="Empresas ativas" value={String(active)} />
      <MetricTile label="Prontas para emitir" value={String(ready)} />
      <MetricTile label="Pendências" value={String(pending.length)} tone={pending.length ? "warning" : "default"} />
      <MetricTile label="Notas emitidas no mês" value={String(issuedResult.count ?? 0)} />
    </section>
    <section className="v2-panel v2-table-panel">
      <div className="v2-panel-heading"><div><h2>Empresas</h2><p>Visão operacional das organizações atendidas.</p></div><Link className="v2-text-action" href="/admin/empresas">Ver todas</Link></div>
      <div className="v2-table-scroll"><table className="v2-table">
        <thead><tr><th>Empresa</th><th>CNPJ</th><th>Município</th><th>Situação</th><th>Certificado</th><th>Acesso</th><th>Última atividade</th><th><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>{companies.slice(0, 8).map((company) => {
          const certificate = certificates.get(company.id);
          const access = accesses.get(company.id);
          return <tr key={company.id}>
            <td><Link className="v2-table-primary" href={`/admin/empresas/${company.id}`}>{company.legal_name}</Link></td>
            <td>{formatTaxId(company.tax_id)}</td>
            <td>{company.municipality_code}{company.state ? ` / ${company.state}` : ""}</td>
            <td><StatusBadge tone={company.emission_blocked ? "warning" : "success"}>{company.emission_blocked ? "Requer atenção" : "Ativa"}</StatusBadge></td>
            <td><StatusBadge tone={!certificate ? "neutral" : certificate.status === "VALID" ? "success" : "warning"}>{!certificate ? "Não cadastrado" : certificate.status === "VALID" ? "Válido" : "Revisar"}</StatusBadge></td>
            <td><StatusBadge tone={access?.enabled ? "success" : "neutral"}>{access?.enabled ? "Ativo" : "Pendente"}</StatusBadge></td>
            <td>{formatDateTime(activity.get(company.id) ?? company.created_at)}</td>
            <td><div className="v2-row-actions"><Link title="Abrir empresa" href={`/admin/empresas/${company.id}`}><ArrowUpRight size={17} /></Link><Link title="Emitir por esta empresa" href={`/admin/empresas/${company.id}?tab=issue`}><FilePlus2 size={17} /></Link><Link title="Mais opções" href={`/admin/empresas/${company.id}`}><Ellipsis size={18} /></Link></div></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!companies.length ? <div className="v2-empty"><Building2 size={22} /><strong>Nenhuma empresa cadastrada.</strong></div> : null}
    </section>
    <section className="v2-panel v2-pending-panel">
      <div className="v2-panel-heading"><div><h2>Pendências</h2><p>Itens que precisam de atenção antes da emissão.</p></div></div>
      {pending.length || unknownResult.count || certificateAttention.length || servicesResult.count || inactiveAccesses || cancellationsResult.count ? <div className="v2-pending-list">{unknownResult.count ? <Link href="/admin/notas?status=UNKNOWN"><span className="v2-attention-mark">!</span><span><strong>{unknownResult.count} NFS-e aguardando confirmação</strong><small>Verifique a situação antes de qualquer nova emissão.</small></span><ArrowUpRight size={17} /></Link> : null}{certificateAttention.length ? <Link href="/admin/certificados"><span className="v2-attention-mark">!</span><span><strong>{certificateAttention.length} certificado(s) exigem atenção</strong><small>Confira vencimentos e validade dos A1.</small></span><ArrowUpRight size={17} /></Link> : null}{servicesResult.count ? <Link href="/admin/servicos?status=PENDING_REVIEW"><span className="v2-attention-mark">!</span><span><strong>{servicesResult.count} serviço(s) aguardando validação</strong><small>Complete a análise fiscal antes da emissão.</small></span><ArrowUpRight size={17} /></Link> : null}{inactiveAccesses ? <Link href="/admin/pendencias"><span className="v2-attention-mark">!</span><span><strong>{inactiveAccesses} acesso(s) de cliente pendente(s)</strong><small>Revise o acesso principal da empresa.</small></span><ArrowUpRight size={17} /></Link> : null}{cancellationsResult.count ? <Link href="/admin/cancelamentos"><span className="v2-attention-mark">!</span><span><strong>{cancellationsResult.count} cancelamento(s) aguardando análise</strong><small>A transmissão de cancelamento continua bloqueada.</small></span><ArrowUpRight size={17} /></Link> : null}{pending.slice(0, 5).map((item) => <Link href={`/admin/empresas/${item.id}`} key={item.id}><span className="v2-attention-mark">!</span><span><strong>{item.legal_name}</strong><small>{item.emission_blocked ? "Onboarding ou liberação de emissão pendente." : `Status atual: ${item.status}.`}</small></span><ArrowUpRight size={17} /></Link>)}</div> : <div className="v2-empty compact"><strong>Nenhuma pendência operacional.</strong></div>}
    </section>
  </div>;
}
