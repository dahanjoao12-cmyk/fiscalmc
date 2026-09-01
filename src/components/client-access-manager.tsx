"use client";
import { useState } from "react";
import { KeyRound, LockKeyhole, RotateCcw, ShieldCheck, UserRoundPlus } from "lucide-react";

type Access = { cnpj: string; status: "ACTIVE" | "BLOCKED" | "INVALID"; createdAt: string; blockedAt: string | null };
type AccessResult = { access: Access | null; readiness: { ready: boolean; status: string; message: string } };

export function ClientAccessManager({ organizationId, organizationTaxId, initial, canWrite }: { organizationId: string; organizationTaxId: string; initial: AccessResult; canWrite: boolean }) {
  const [result, setResult] = useState(initial);
  const [mode, setMode] = useState<"CREATE" | "RESET" | "REPAIR" | null>(initial.access ? null : "CREATE");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function request(method: "POST" | "PATCH", body: Record<string, string>) {
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/client-access`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as AccessResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o acesso.");
      setResult(payload); setPassword(""); setConfirmPassword(""); setMode(null);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o acesso.");
      return false;
    } finally { setSaving(false); }
  }

  async function submitPassword() {
    if (password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); return; }
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    const created = mode === "CREATE";
    const repaired = mode === "REPAIR";
    const body: Record<string, string> = created ? { password, confirmPassword } : { action: repaired ? "REPAIR" : "RESET_PASSWORD", password, confirmPassword };
    if (await request(created ? "POST" : "PATCH", body)) setNotice(created ? "Acesso criado com sucesso." : repaired ? "Acesso do cliente reparado com sucesso." : "Senha redefinida com sucesso.");
  }

  async function changeState(action: "BLOCK" | "REACTIVATE") {
    if (action === "BLOCK" && !window.confirm("Bloquear este acesso agora? O cliente deixará de acessar a área da empresa.")) return;
    if (await request("PATCH", { action })) setNotice(action === "BLOCK" ? "Acesso bloqueado." : "Acesso reativado.");
  }

  const access = result.access;
  return <section className="client-access-manager">
    <div className="client-access-header"><div><p className="eyebrow">Acesso do cliente</p><h2>{access ? result.readiness.message : "Nenhum acesso cadastrado."}</h2><p>O cliente entra apenas com CNPJ e senha. A identidade técnica permanece interna.</p></div>{access?.status === "ACTIVE" ? <ShieldCheck className="client-access-icon valid" /> : <LockKeyhole className="client-access-icon" />}</div>
    {access && <dl className="client-access-details">
      <div><dt>CNPJ</dt><dd>{formatCnpj(access.cnpj || organizationTaxId)}</dd></div>
      <div><dt>Status</dt><dd><span className={`status ${access.status === "ACTIVE" ? "" : "warning"}`}>{access.status === "ACTIVE" ? "Ativo" : access.status === "BLOCKED" ? "Bloqueado" : "Requer revisão"}</span></dd></div>
      <div><dt>Criado em</dt><dd>{formatDate(access.createdAt)}</dd></div>
      <div><dt>Senha</dt><dd>Protegida pelo Supabase Auth</dd></div>
    </dl>}
    {notice && <p className="alert success" role="status">{notice}</p>}
    {error && <p className="alert error" role="alert">{error}</p>}
    {!canWrite && <p className="client-access-note">Seu perfil pode consultar o status, mas somente superadministradores podem alterar o acesso.</p>}
    {canWrite && mode && <div className="client-access-password-form">
      <div><strong>{mode === "CREATE" ? "Criar acesso principal" : mode === "REPAIR" ? "Reparar acesso do cliente" : "Redefinir senha"}</strong><p>{mode === "CREATE" ? `O acesso será criado para o CNPJ ${formatCnpj(organizationTaxId)}.` : mode === "REPAIR" ? "Uma nova identidade CLIENT_USER será criada. O acesso administrativo atual será preservado." : "A senha atual não será exibida nem recuperada."}</p></div>
      <label>Nova senha<input className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} /></label>
      <label>Confirmar senha<input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} /></label>
      <div className="client-access-form-actions">{access && <button className="button ghost" type="button" onClick={() => { setMode(null); setError(null); }}>Cancelar</button>}<button className="button primary" type="button" onClick={submitPassword} disabled={saving}><UserRoundPlus size={18}/>{saving ? "Salvando…" : mode === "CREATE" ? "Criar acesso" : mode === "REPAIR" ? "Criar acesso CLIENT_USER" : "Salvar nova senha"}</button></div>
    </div>}
    {canWrite && access && !mode && <div className="client-access-actions">
      {access.status === "INVALID" ? <button className="button primary" type="button" onClick={() => { setMode("REPAIR"); setError(null); setNotice(null); }}><UserRoundPlus size={17}/>Reparar acesso do cliente</button> : null}
      {access.status === "ACTIVE" ? <button className="button secondary" type="button" onClick={() => changeState("BLOCK")} disabled={saving}><LockKeyhole size={17}/>Bloquear acesso</button> : <button className="button primary" type="button" onClick={() => changeState("REACTIVATE")} disabled={saving}><RotateCcw size={17}/>Reativar acesso</button>}
      <button className="button ghost" type="button" onClick={() => { setMode("RESET"); setError(null); setNotice(null); }}><KeyRound size={17}/>Redefinir senha</button>
    </div>}
  </section>;
}

function formatCnpj(value: string) { const digits = value.replace(/\D/g, ""); return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value)); }
