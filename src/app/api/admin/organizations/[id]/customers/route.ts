import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTaxId } from "@/lib/validation/identification";

export const runtime = "nodejs";

const customerSchema = z.object({
  personType: z.enum(["INDIVIDUAL", "COMPANY", "FOREIGN"]),
  taxId: z.string().trim().max(20).optional().nullable(),
  legalName: z.string().trim().min(2).max(250),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
});

/**
 * Office-only: registers a tomador on behalf of a company. The client's own
 * self-service /app/tomadores flow remains the normal path — this exists for
 * companies the office issues for directly, where waiting on the client to
 * log in first isn't realistic.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOfficeSession();
    const { id: organizationId } = await params;
    const input = customerSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("customers").insert({
      organization_id: organizationId,
      person_type: input.personType,
      tax_id: input.taxId ? normalizeTaxId(input.taxId) : null,
      legal_name: input.legalName,
      email: input.email || null,
      phone: input.phone || null,
      address: {},
    }).select("id,legal_name,tax_id,person_type").single();
    if (error) throw error;
    await admin.from("audit_logs").insert({ organization_id: organizationId, actor_user_id: session.userId, actor_type: "OFFICE", action: "customer_created", entity: "customer", entity_id: data.id, safe_metadata: {} });
    return NextResponse.json({ customer: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revise os dados do tomador." }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível salvar o tomador. Documento já pode estar cadastrado." }, { status: 422 });
  }
}
