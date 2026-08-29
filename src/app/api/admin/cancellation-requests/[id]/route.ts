import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { can } from "@/lib/security/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ action: z.enum(["review", "deny"]), note: z.string().trim().max(1000).optional() }).strict();
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOfficeSession();
    if (!can(session.role, "invoice:reconcile")) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const { id } = await context.params;
    const input = schema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Ação de revisão inválida." }, { status: 422 });
    const db = createAdminClient();
    const { data: cancellation } = await db.from("cancellation_requests").select("id,organization_id,status").eq("id", id).maybeSingle();
    if (!cancellation) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    if (!["REQUESTED", "UNDER_REVIEW"].includes(cancellation.status)) return NextResponse.json({ error: "Esta solicitação não pode mais ser revisada." }, { status: 422 });
    const now = new Date().toISOString();
    const nextStatus = input.data.action === "review" ? "UNDER_REVIEW" : "DENIED";
    const { error } = await db.from("cancellation_requests").update({ status: nextStatus, review_note: input.data.note ?? null, reviewed_by: session.userId, reviewed_at: now, updated_at: now }).eq("id", id).eq("organization_id", cancellation.organization_id);
    if (error) return NextResponse.json({ error: "Não foi possível atualizar a solicitação." }, { status: 500 });
    await db.from("audit_logs").insert({ actor_user_id: session.userId, actor_type: "OFFICE", organization_id: cancellation.organization_id, action: input.data.action === "review" ? "cancellation_reviewed" : "cancellation_rejected", entity: "cancellation_request", entity_id: id, request_id: crypto.randomUUID(), safe_metadata: { status: nextStatus } });
    return NextResponse.json({ status: nextStatus, message: nextStatus === "UNDER_REVIEW" ? "Solicitação em análise pelo escritório." : "Solicitação não aprovada." });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar a solicitação." }, { status: 500 });
  }
}
