import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const dismissSchema = z.object({ itemId: z.string().min(1), itemType: z.string().min(1), organizationId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await requireOfficeSession();
    const input = dismissSchema.parse(await request.json());
    const db = createAdminClient();
    const { error } = await db.from("pendency_dismissals").insert({
      item_id: input.itemId,
      item_type: input.itemType,
      organization_id: input.organizationId,
      dismissed_by: session.userId,
    });
    if (error && error.code !== "23505") throw error; // 23505 = already dismissed, treat as success
    await db.from("audit_logs").insert({ organization_id: input.organizationId, actor_user_id: session.userId, actor_type: "OFFICE", action: "pendency_dismissed", entity: "operational_queue", entity_id: input.itemId, safe_metadata: { itemType: input.itemType } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Revise os dados informados." : "Não foi possível marcar como resolvido." }, { status: 422 });
  }
}
