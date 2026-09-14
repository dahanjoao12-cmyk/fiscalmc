import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNbsCandidatesForActivity } from "@/lib/organizations/nbs-activity-resolver";

export async function GET(request: Request) {
  try {
    await requireOfficeSession();
    const url = new URL(request.url);
    const nationalServiceCodeId = z.string().uuid().parse(url.searchParams.get("nationalServiceCodeId"));
    const { data: code, error } = await createAdminClient().from("national_service_codes").select("item,subitem").eq("id", nationalServiceCodeId).maybeSingle();
    if (error) throw error;
    if (!code) return NextResponse.json({ candidates: [] });
    return NextResponse.json({ candidates: getNbsCandidatesForActivity(code.item, code.subitem) });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as sugestões de NBS." }, { status: 403 });
  }
}
