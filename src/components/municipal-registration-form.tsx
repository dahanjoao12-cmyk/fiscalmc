"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MunicipalRegistrationForm({ organizationId, initialValue }: { organizationId: string; initialValue: string | null }) {
  const router = useRouter();
  const [municipalRegistration, setMunicipalRegistration] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/registration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipalRegistration }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) { setMessage(result?.error ?? "Não foi possível salvar a inscrição municipal."); return; }
      setMessage("Inscrição municipal salva.");
      router.refresh();
    } catch { setMessage("Não foi possível salvar a inscrição municipal."); }
    finally { setSaving(false); }
  }

  return <section className="v2-panel"><div className="v2-panel-heading"><div><h2>Inscrição municipal</h2><p>Atualize somente com dado confirmado pela empresa.</p></div></div><form onSubmit={save} className="company-form"><div className="company-form-grid"><label className="field company-field" htmlFor="municipal-registration"><span>Inscrição municipal</span><input id="municipal-registration" className="input" value={municipalRegistration} onChange={(event) => setMunicipalRegistration(event.target.value)} maxLength={80} required /></label></div><div className="company-form-actions"><button className="button primary" disabled={saving}>{saving ? "Salvando…" : "Salvar inscrição municipal"}</button></div>{message ? <p className={message.includes("salva") ? "alert success" : "alert error"} role="status">{message}</p> : null}</form></section>;
}
