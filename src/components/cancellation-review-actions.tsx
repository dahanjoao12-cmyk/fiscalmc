"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancellationReviewActions({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  if (!["REQUESTED", "UNDER_REVIEW"].includes(status)) return null;
  async function update(action: "review" | "deny") { setLoading(true); setMessage(""); try { const response = await fetch(`/api/admin/cancellation-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const body = await response.json() as { error?: string; message?: string }; setMessage(response.ok ? body.message ?? "Solicitação atualizada." : body.error ?? "Não foi possível atualizar."); if (response.ok) router.refresh(); } catch { setMessage("Não foi possível atualizar."); } finally { setLoading(false); } }
  return <div className="v2-inline-actions cancellation-office-actions"><button className="button secondary compact" type="button" onClick={() => update("review")} disabled={loading}>Assumir análise</button><button className="button ghost compact" type="button" onClick={() => update("deny")} disabled={loading}>Não aprovar</button>{message ? <small aria-live="polite">{message}</small> : null}</div>;
}
