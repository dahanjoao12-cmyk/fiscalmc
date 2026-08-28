import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionOrganization } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildClientServiceCreate,
  buildClientServiceSubmission,
  buildClientServiceUpdate,
  canClientEditService,
  clientServiceFieldsSchema,
  clientServiceMutationSchema,
  type ClientServiceRecord,
  type ServiceWorkflowStatus,
} from "@/lib/services/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientServiceSelect = "id,name,default_description,client_service_location,client_note,needs_info_message,workflow_status,submitted_at,created_at,updated_at";
const internalServiceSelect = `${clientServiceSelect},active,reviewed_at,reviewed_by`;

function clientServiceResponse(service: Record<string, unknown>) {
  return {
    id: service.id,
    name: service.name,
    default_description: service.default_description,
    client_service_location: service.client_service_location,
    client_note: service.client_note,
    needs_info_message: service.needs_info_message,
    workflow_status: service.workflow_status,
    submitted_at: service.submitted_at,
    created_at: service.created_at,
    updated_at: service.updated_at,
  };
}

async function requireClientSession() {
  const session = await requireSessionOrganization();
  if (session.role !== "CLIENT_USER") throw new Error("FORBIDDEN_CLIENT_SERVICE");
  return session;
}

export async function GET() {
  try {
    const session = await requireClientSession();
    const { data, error } = await createAdminClient()
      .from("service_templates")
      .select(clientServiceSelect)
      .eq("organization_id", session.organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ services: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Acesso do cliente necessário." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClientSession();
    const input = clientServiceFieldsSchema.parse(await request.json());
    const db = createAdminClient();
    const values = buildClientServiceCreate(input, session.userId);
    const { data, error } = await db.from("service_templates").insert({
      organization_id: session.organizationId,
      national_tax_code: null,
      ...values,
    }).select(clientServiceSelect).single();
    if (error || !data) throw error ?? new Error("CLIENT_SERVICE_CREATE_FAILED");
    await db.from("audit_logs").insert({
      organization_id: session.organizationId,
      actor_user_id: session.userId,
      action: "client_service_created",
      entity: "service_template",
      entity_id: data.id,
      safe_metadata: { workflowStatus: "DRAFT" },
    });
    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Revise as informações do serviço." : "Não foi possível cadastrar o serviço." }, { status: 422 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireClientSession();
    const input = clientServiceMutationSchema.parse(await request.json());
    if (input.action === "create") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    const db = createAdminClient();
    const { data: current } = await db.from("service_templates").select(internalServiceSelect)
      .eq("id", input.id)
      .eq("organization_id", session.organizationId)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });
    const record = current as ClientServiceRecord & { id: string };
    if (!canClientEditService(record.workflow_status as ServiceWorkflowStatus)) {
      return NextResponse.json({ error: "Este serviço está inativo e não pode ser alterado." }, { status: 422 });
    }
    const now = new Date().toISOString();
    if (input.action === "submit") {
      const commercial = clientServiceFieldsSchema.safeParse({
        name: record.name,
        defaultDescription: record.default_description,
        serviceLocationMode: record.client_service_location ? "OTHER" : "ORGANIZATION",
        serviceLocation: record.client_service_location,
        clientNote: record.client_note,
      });
      if (!commercial.success) return NextResponse.json({ error: "Complete as informações comerciais antes de enviar para análise." }, { status: 422 });
      const values = buildClientServiceSubmission(record, now);
      const { data, error } = await db.from("service_templates").update({ ...values, updated_at: now })
        .eq("id", input.id).eq("organization_id", session.organizationId).select(clientServiceSelect).single();
      if (error || !data) throw error ?? new Error("CLIENT_SERVICE_SUBMIT_FAILED");
      await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, action: "client_service_submitted_for_review", entity: "service_template", entity_id: input.id, safe_metadata: {} });
      return NextResponse.json({ service: data });
    }
    const update = buildClientServiceUpdate(record, input, now);
    if (!update.changed) return NextResponse.json({ service: clientServiceResponse(current as unknown as Record<string, unknown>) });
    const { data, error } = await db.from("service_templates").update({ ...update.values, updated_at: now })
      .eq("id", input.id).eq("organization_id", session.organizationId).select(clientServiceSelect).single();
    if (error || !data) throw error ?? new Error("CLIENT_SERVICE_UPDATE_FAILED");
    await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, action: "client_service_updated", entity: "service_template", entity_id: input.id, safe_metadata: {} });
    if (update.reviewReset) await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, action: "service_review_reset", entity: "service_template", entity_id: input.id, safe_metadata: { reason: "client_material_change" } });
    return NextResponse.json({ service: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Revise as informações do serviço." : "Não foi possível atualizar o serviço." }, { status: 422 });
  }
}
