import { NextResponse } from "next/server";
import { requireSessionOrganization } from "@/lib/auth/session";
import { SafeFiscalError } from "@/lib/nfse/errors";
import { reconcileUnknownInvoice } from "@/lib/nfse/reconciliation/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Re-checks an existing UNKNOWN invoice. It never creates a DPS or retransmits it. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionOrganization();
    const { id } = await context.params;
    const db = createAdminClient();
    const { data: invoice } = await db.from("invoices").select("id,organization_id").eq("id", id).eq("organization_id", session.organizationId).maybeSingle();
    if (!invoice) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

    const result = await reconcileUnknownInvoice({ invoiceId: invoice.id, organizationId: session.organizationId });
    await db.from("audit_logs").insert({
      actor_user_id: session.userId,
      actor_type: session.role === "CLIENT_USER" ? "CLIENT" : "OFFICE",
      organization_id: session.organizationId,
      action: "invoice_reconciliation_requested",
      entity: "invoice",
      entity_id: invoice.id,
      request_id: crypto.randomUUID(),
      safe_metadata: { status: result.status },
    });
    const message = result.status === "UNKNOWN"
      ? "Ainda estamos confirmando a situação desta NFS-e. Não emita novamente."
      : "A situação da nota foi atualizada.";
    return NextResponse.json({ status: result.status, message });
  } catch (error) {
    if (error instanceof SafeFiscalError) return NextResponse.json({ error: error.safeMessage }, { status: error.retryable ? 503 : 422 });
    return NextResponse.json({ error: "Não foi possível verificar a situação da nota agora." }, { status: 500 });
  }
}
