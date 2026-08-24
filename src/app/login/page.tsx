import Link from "next/link";
import { Brand } from "@/components/brand";
import { login } from "./actions";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"#f7f9fb" }}>
    <section style={{ width:"min(420px,100%)", background:"white", border:"1px solid var(--border)", borderRadius:12, padding:"34px 32px" }}>
      <Brand />
      <h1 style={{ margin:"40px 0 8px", fontSize:30, color:"var(--navy)", letterSpacing:"-.03em" }}>Acesse sua conta</h1>
      <p style={{ color:"var(--muted)", margin:"0 0 28px" }}>Emita e acompanhe suas notas fiscais de serviço.</p>
      <form action={login}>
        <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <Link href="/recuperar-senha" style={{ display:"block", margin:"16px 0 22px", color:"var(--emerald-dark)", fontSize:14, fontWeight:700 }}>Esqueci minha senha</Link>
        <button className="button primary" style={{ width:"100%" }} type="submit">Entrar</button>
      </form>
      <p style={{ color:"var(--muted)", fontSize:12, margin:"20px 0 0", lineHeight:1.5 }}>Demonstração local: qualquer e-mail e senha abrem o ambiente mock. Com Supabase configurado, a autenticação é validada no servidor.</p>
    </section>
  </main>;
}
