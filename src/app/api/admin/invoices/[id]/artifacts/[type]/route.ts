import { NextResponse } from "next/server";
import { requireOfficeSession } from "@/lib/auth/session";
import { downloadAuthorizedFiscalArtifact } from "@/lib/nfse/artifacts/download";
import { fiscalArtifactTypes, type FiscalArtifactType } from "@/lib/nfse/artifacts/model";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; type: string }> }) {
  try {
    const session = await requireOfficeSession();
    const { id, type } = await context.params;
    if (!fiscalArtifactTypes.includes(type as FiscalArtifactType)) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    const db = createAdminClient();
    const { data: invoice } = await db.from("invoices").select("id,organization_id,nfse_number").eq("id", id).maybeSingle();
    if (!invoice) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    const document = await downloadAuthorizedFiscalArtifact({ invoiceId: id, organizationId: invoice.organization_id, artifactType: type as FiscalArtifactType, nfseNumber: invoice.nfse_number });
    if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    await db.from("audit_logs").insert({ actor_user_id: session.userId, actor_type: "OFFICE", organization_id: invoice.organization_id, action: "artifact_downloaded", entity: "fiscal_artifact", entity_id: document.artifact.id, request_id: crypto.randomUUID(), safe_metadata: { type: document.artifact.artifact_type, invoiceId: id } });
    return new NextResponse(document.body, { headers: { "Content-Type": document.artifact.content_type, "Content-Disposition": `attachment; filename="${document.filename}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível baixar o documento agora." }, { status: 500 });
  }
}
