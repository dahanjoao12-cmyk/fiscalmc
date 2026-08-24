import Link from "next/link";
import { Building2, FilePlus2, FileText, Home, LogOut, Settings, UserRound, UsersRound } from "lucide-react";
import { Brand } from "./brand";

type ShellProps = { children: React.ReactNode; active: "home" | "issue" | "invoices" | "customers" | "companies" | "settings"; admin?: boolean };

const clientNav = [
  ["home", "/app", "Início", Home],
  ["issue", "/app/emitir", "Emitir NFS-e", FilePlus2],
  ["invoices", "/app/notas", "Notas fiscais", FileText],
  ["customers", "/app/tomadores", "Tomadores", UsersRound]
] as const;
const adminNav = [
  ["home", "/admin", "Visão geral", Home],
  ["companies", "/admin/empresas", "Empresas", Building2],
  ["invoices", "/admin/notas", "Notas fiscais", FileText],
  ["settings", "/admin/configuracoes", "Configurações", Settings]
] as const;

export function AppShell({ children, active, admin = false }: ShellProps) {
  const nav = admin ? adminNav : clientNav;
  const switchHref = admin ? "/app" : "/admin";
  const switchLabel = admin ? "Área do cliente" : "Área do escritório";
  const SwitchIcon = admin ? UserRound : Building2;
  return <div className="shell">
    <aside className={`sidebar${admin ? " admin" : ""}`}>
      <Brand />
      <nav className="nav" aria-label="Navegação principal">
        {nav.map(([key, href, label, Icon]) => <Link key={key} href={href} className={`nav-link ${active === key ? "active" : ""}`}><Icon size={20} aria-hidden />{label}</Link>)}
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-link role-switch" href={switchHref}><SwitchIcon size={19} aria-hidden />{switchLabel}</Link>
        <Link className="nav-link" href="/login"><LogOut size={19} aria-hidden />Sair</Link>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <Link className="mobile-brand" href={admin ? "/admin" : "/app"} aria-label={admin ? "Início da área do escritório" : "Início da área do cliente"}><Brand /></Link>
        <div className="topbar-actions">
        <Link className="mobile-role-switch" href={switchHref} aria-label={switchLabel}><SwitchIcon size={18} aria-hidden /><span>{admin ? "Cliente" : "Escritório"}</span></Link>
        <div className="identity"><span className="organization">{admin ? "Escritório Moreira & Castro" : "Almeida Consultoria"}</span><span className="avatar" aria-hidden>{admin ? "MM" : "J"}</span><span>{admin ? "Marina" : "João"}</span></div>
      </div></header>
      {children}
    </main>
    <nav className={`mobile-nav${admin ? " admin" : ""}`} aria-label={admin ? "Navegação do escritório" : "Navegação do cliente"}>
      {nav.map(([key, href, label, Icon]) => <Link key={key} href={href} className={active === key ? "active" : ""}><Icon size={22} aria-hidden /><span>{mobileLabel(key, label)}</span></Link>)}
    </nav>
  </div>;
}

function mobileLabel(key: string, label: string) {
  if (key === "invoices") return "Notas";
  if (key === "issue") return "Emitir";
  if (key === "companies") return "Empresas";
  if (key === "settings") return "Ajustes";
  if (label === "Visão geral") return "Visão";
  return label;
}
