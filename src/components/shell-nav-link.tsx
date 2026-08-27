"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavKey="home"|"issue"|"invoices"|"customers"|"companies"|"settings";

function activeKey(pathname:string):NavKey{
  if(pathname.startsWith("/admin/empresas"))return "companies";
  if(pathname.startsWith("/admin/notas"))return "invoices";
  if(pathname.startsWith("/admin/configuracoes"))return "settings";
  if(pathname.startsWith("/admin"))return "home";
  if(pathname.startsWith("/app/emitir"))return "issue";
  if(pathname.startsWith("/app/notas"))return "invoices";
  if(pathname.startsWith("/app/tomadores"))return "customers";
  return "home";
}

export function ShellNavLink({itemKey,href,className="",children}:{itemKey:NavKey;href:string;className?:string;children:React.ReactNode}){
  const pathname=usePathname();
  const active=activeKey(pathname)===itemKey;
  return <Link href={href} className={`${className}${active?`${className?" ":""}active`:""}`}>{children}</Link>;
}
