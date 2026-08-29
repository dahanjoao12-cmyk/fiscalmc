import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionOrganization } from "@/lib/auth/session";
import { isCancellationOpen } from "@/lib/operations/queue";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionOrganization();
    if (session.role !== "CLIENT_USER") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const { id } = await context.params;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey || !z.uuid().safeParse(idempotencyKey).success) return NextResponse.json({ error: "Não foi possível criar a solicitação." }, { status: 400 });
    const input = schema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Informe um motivo entre 10 e 500 caracteres." }, { status: 422 });
    const db = createAdminClient();
    const { data: invoice } = await db.from("invoices").select("id,status").eq("id", id).eq("organization_id", session.organizationId).maybeSingle();
    if (!invoice || invoice.status !== "ISSUED") return NextResponse.json({ error: "Esta nota não está disponível para solicitação de cancelamento." }, { status: 422 });
    const { data: previous } = await db.from("cancellation_requests").select("id,status").eq("invoice_id", id).eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (previous && isCancellationOpen(previous.status)) return NextResponse.json({ id: previous.id, status: previous.status, message: "Já existe uma solicitação de cancelamento em análise." });
    const { data: existingKey } = await db.from("cancellation_requests").select("id,status").eq("organization_id", session.organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existingKey) return NextResponse.json({ id: existingKey.id, status: existingKey.status, message: "Solicitação de cancelamento registrada." });
    const now = new Date().toISOString();
    const { data: created, error } = await db.from("cancellation_requests").insert({ invoice_id: id, organization_id: session.organizationId, requested_by: session.userId, reason: input.data.reason, status: "REQUESTED", idempotency_key: idempotencyKey, request_id: crypto.randomUUID(), updated_at: now }).select("id,status").single();
    if (error || !created) return NextResponse.json({ error: "Não foi possível criar a solicitação agora." }, { status: 500 });
    await db.from("audit_logs").insert({ actor_user_id: session.userId, actor_type: "CLIENT", organization_id: session.organizationId, action: "cancellation_requested", entity: "cancellation_request", entity_id: created.id, request_id: crypto.randomUUID(), safe_metadata: { invoiceId: id } });
    return NextResponse.json({ id: created.id, status: created.status, message: "Cancelamento solicitado. A Moreira & Castro analisará o pedido." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar a solicitação agora." }, { status: 500 });
  }
}
