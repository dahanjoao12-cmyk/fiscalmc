import { NextResponse } from "next/server";
import { requireSessionOrganization } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCnaeActivity } from "@/lib/organizations/cnae-activity-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CnaeSecundario = { code?: string; description?: string };

/** Client-facing, pre-filtered to the company's own CNPJ card. Only unambiguous matches are offered. */
export async function GET() {
  try {
    const session = await requireSessionOrganization();
    if (session.role !== "CLIENT_USER") throw new Error("FORBIDDEN_CLIENT_ACTIVITIES");
    const db = createAdminClient();
    const { data: organization } = await db.from("organizations").select("cnaes_secundarios").eq("id", session.organizationId).maybeSingle();
    const secundarios = (organization?.cnaes_secundarios ?? []) as CnaeSecundario[];
    const activities: Array<{ cnae: string; cnaeDescription: string; nationalServiceCodeId: string; description: string; added: boolean }> = [];
    for (const item of secundarios) {
      if (!item.code) continue;
      const resolution = await resolveCnaeActivity(db, item.code);
      if (resolution.candidates.length !== 1) continue;
      const candidate = resolution.candidates[0];
      const { data: existing } = await db.from("service_templates").select("id").eq("organization_id", session.organizationId).eq("national_service_code_id", candidate.nationalServiceCodeId).maybeSingle();
      activities.push({ cnae: item.code, cnaeDescription: item.description ?? "", nationalServiceCodeId: candidate.nationalServiceCodeId, description: candidate.description, added: Boolean(existing) });
    }
    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: "Acesso do cliente necessário." }, { status: 403 });
  }
}
