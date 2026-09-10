import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(0).max(10000).default(0), organizationId: z.uuid() });
const pageSize = 16;

/** Commercial catalog only: fiscal identifiers and mappings never leave this route. Office-only. */
export async function GET(request: Request) {
  try {
    await requireOfficeSession();
    const params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const db = createAdminClient();
    let query = db.from("national_service_codes").select("id,description", { count: "exact" }).eq("active", true).order("description").range(params.page * pageSize, params.page * pageSize + pageSize - 1);
    if (params.q) query = query.ilike("description", `%${params.q.replace(/[%,()]/g, "")}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    const page = data ?? [];
    const existing = page.length ? await db.from("service_templates").select("national_service_code_id").eq("organization_id", params.organizationId).in("national_service_code_id", page.map((item) => item.id)) : { data: [] };
    const added = new Set((existing.data ?? []).map((item) => item.national_service_code_id));
    return NextResponse.json({ services: page.map((item) => ({ id: item.id, description: item.description, added: added.has(item.id) })), total: count ?? 0, page: params.page, hasMore: (params.page + 1) * pageSize < (count ?? 0) });
  } catch {
    return NextResponse.json({ error: "Acesso do escritório necessário." }, { status: 403 });
  }
}
