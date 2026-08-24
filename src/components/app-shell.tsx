import Link from "next/link";
import { Building2, FilePlus2, FileText, Home, LogOut, Settings, UsersRound } from "lucide-react";
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
  return <div className="shell">
    <aside className={`sidebar${admin ? " admin" : ""}`}>
      <Brand />
      <nav className="nav" aria-label="Navegação principal">
        {nav.map(([key, href, label, Icon]) => <Link key={key} href={href} className={`nav-link ${active === key ? "active" : ""}`}><Icon size={20} aria-hidden />{label}</Link>)}
      </nav>
      <div className="sidebar-bottom"><Link className="nav-link" href="/login"><LogOut size={19} aria-hidden />Sair</Link></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="identity"><span className="organization">{admin ? "Escritório Moreira & Castro" : "Almeida Consultoria"}</span><span className="avatar" aria-hidden>{admin ? "MM" : "J"}</span><span>{admin ? "Marina" : "João"}</span></div></header>
      {children}
    </main>
    {!admin && <nav className="mobile-nav" aria-label="Navegação móvel">
      {clientNav.map(([key, href, label, Icon]) => <Link key={key} href={href} className={active === key ? "active" : ""}><Icon size={22} aria-hidden /><span>{key === "invoices" ? "Notas" : key === "issue" ? "Emitir" : label}</span></Link>)}
    </nav>}
  </div>;
}
