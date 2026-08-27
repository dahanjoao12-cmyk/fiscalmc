import Link from "next/link";
import { Brand } from "@/components/brand";
import { login } from "./actions";

export const metadata = { title: "Entrar" };

const loginErrors:Record<string,string>={invalid_credentials:"CNPJ ou senha inválidos.",rate_limited:"Muitas tentativas. Aguarde um minuto e tente novamente.",configuration:"O acesso está temporariamente indisponível. Entre em contato com o escritório."};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {error}=await searchParams;
  return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"#f7f9fb" }}>
    <section style={{ width:"min(420px,100%)", background:"white", border:"1px solid var(--border)", borderRadius:12, padding:"34px 32px" }}>
      <Brand />
      <h1 style={{ margin:"40px 0 8px", fontSize:30, color:"var(--navy)", letterSpacing:"-.03em" }}>Acesse sua conta</h1>
      <p style={{ color:"var(--muted)", margin:"0 0 28px" }}>Emita e acompanhe suas notas fiscais de serviço.</p>
      {error&&loginErrors[error]&&<p className="alert error" role="alert">{loginErrors[error]}</p>}
      <form action={login}>
        <div className="field"><label htmlFor="cnpj">CNPJ</label><input className="input" id="cnpj" name="cnpj" inputMode="text" autoComplete="username" placeholder="00.000.000/0000-00" required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <p style={{ margin:"16px 0 22px", color:"var(--muted)", fontSize:13 }}>Esqueceu a senha? Solicite a redefinição ao escritório.</p>
        <button className="button primary" style={{ width:"100%" }} type="submit">Entrar</button>
      </form>
      <p style={{ color:"var(--muted)", fontSize:12, margin:"20px 0 0", lineHeight:1.5 }}>Seu acesso é vinculado ao CNPJ da empresa. O endereço técnico de autenticação permanece interno.</p>
      <Link href="/login/escritorio" style={{ display:"block", marginTop:16, color:"var(--muted)", fontSize:13, textAlign:"center" }}>Acesso do escritório</Link>
    </section>
  </main>;
}
