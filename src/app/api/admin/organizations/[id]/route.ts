import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/security/authorization";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOfficeSession();
    if (!can(session.role, "company:write")) return NextResponse.json({ error: "Apenas um administrador pode remover uma empresa." }, { status: 403 });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    const db = createAdminClient();
    const { data: organization } = await db.from("organizations").select("id,legal_name").eq("id", id).maybeSingle();
    if (!organization) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    const { error } = await db.from("organizations").delete().eq("id", id);
    if (error) {
      // 23503: foreign_key_violation -- invoices reference organizations ON DELETE RESTRICT
      // specifically so a company with real fiscal history (issued or attempted) can never
      // be hard-deleted, even by an admin. This is intentional, not a bug to work around.
      if (error.code === "23503") return NextResponse.json({ error: "Esta empresa já tem notas fiscais (emitidas ou tentadas) e não pode ser removida. Bloqueie a emissão ou desative o acesso em vez de remover." }, { status: 409 });
      throw error;
    }
    await db.from("audit_logs").insert({ organization_id: null, actor_user_id: session.userId, actor_type: "OFFICE", action: "organization_deleted", entity: "organization", entity_id: id, safe_metadata: { legalName: organization.legal_name } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível remover a empresa." }, { status: 422 });
  }
}
