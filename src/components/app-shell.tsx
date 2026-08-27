import Link from "next/link";
import { Suspense } from "react";
import { Building2, FilePlus2, FileText, Home, LogOut, Settings, UserRound, UsersRound } from "lucide-react";
import { Brand } from "./brand";
import { ShellNavLink } from "./shell-nav-link";
import { getShellIdentity } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";

type ShellProps = { children: React.ReactNode; admin?: boolean };

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

export function AppShell({ children, admin = false }: ShellProps) {
  const nav = admin ? adminNav : clientNav;
  const switchHref = admin ? "/app" : "/admin";
  const switchLabel = admin ? "Área do cliente" : "Área do escritório";
  const SwitchIcon = admin ? UserRound : Building2;
  return <div className="shell">
    <aside className={`sidebar${admin ? " admin" : ""}`}>
      <Brand />
      <nav className="nav" aria-label="Navegação principal">
        {nav.map(([key, href, label, Icon]) => <ShellNavLink key={key} itemKey={key} href={href} className="nav-link"><Icon size={20} aria-hidden />{label}</ShellNavLink>)}
      </nav>
      <div className="sidebar-bottom">
        {admin?<Link className="nav-link role-switch" href={switchHref}><SwitchIcon size={19} aria-hidden />{switchLabel}</Link>:<Suspense fallback={null}><OfficeSwitch className="nav-link role-switch" href={switchHref} label={switchLabel} iconSize={19}/></Suspense>}
        <form action={logout}><button className="nav-link" type="submit"><LogOut size={19} aria-hidden />Sair</button></form>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <Link className="mobile-brand" href={admin ? "/admin" : "/app"} aria-label={admin ? "Início da área do escritório" : "Início da área do cliente"}><Brand /></Link>
        <div className="topbar-actions">
        {admin?<Link className="mobile-role-switch" href={switchHref} aria-label={switchLabel}><SwitchIcon size={18} aria-hidden /><span>Cliente</span></Link>:<Suspense fallback={null}><OfficeSwitch className="mobile-role-switch" href={switchHref} label={switchLabel} iconSize={18} compact/></Suspense>}
        <Suspense fallback={<IdentityFallback admin={admin}/>}><ShellIdentity admin={admin}/></Suspense>
      </div></header>
      {children}
    </main>
    <nav className={`mobile-nav${admin ? " admin" : ""}`} aria-label={admin ? "Navegação do escritório" : "Navegação do cliente"}>
      {nav.map(([key, href, label, Icon]) => <ShellNavLink key={key} itemKey={key} href={href}><Icon size={22} aria-hidden /><span>{mobileLabel(key, label)}</span></ShellNavLink>)}
    </nav>
  </div>;
}

async function OfficeSwitch({className,href,label,iconSize,compact=false}:{className:string;href:string;label:string;iconSize:number;compact?:boolean}){
  const identity=await getShellIdentity();
  if(!identity?.canAccessOffice)return null;
  return <Link className={className} href={href} aria-label={label}><Building2 size={iconSize} aria-hidden /><span>{compact?"Escritório":label}</span></Link>;
}

async function ShellIdentity({admin}:{admin:boolean}){
  const identity=await getShellIdentity();
  const displayName=identity?.displayName??"Usuário";
  return <div className="identity"><span className="organization">{admin ? "Escritório" : "Área do cliente"}</span><span className="avatar" aria-hidden>{displayName.slice(0,1).toUpperCase()}</span><span>{displayName}</span></div>;
}

function IdentityFallback({admin}:{admin:boolean}){
  return <div className="identity identity-loading" aria-label="Carregando perfil"><span className="organization">{admin ? "Escritório" : "Área do cliente"}</span><span className="avatar" aria-hidden>…</span><span className="identity-name-skeleton"/></div>;
}

function mobileLabel(key: string, label: string) {
  if (key === "invoices") return "Notas";
  if (key === "issue") return "Emitir";
  if (key === "companies") return "Empresas";
  if (key === "settings") return "Ajustes";
  if (label === "Visão geral") return "Visão";
  return label;
}
