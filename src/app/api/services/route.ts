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
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientServiceSelect = "id,name,default_description,client_service_location,client_note,needs_info_message,workflow_status,submitted_at,created_at,updated_at";
const internalServiceSelect = `${clientServiceSelect},active,reviewed_at,reviewed_by`;
const catalogServiceSchema = z.object({ action: z.literal("add-catalog"), nationalServiceCodeId: z.uuid() });
const reusableFiscalFields = "national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,nbs_code,iss_taxation,iss_rate_source,fiscal_reference,active,workflow_status,reviewed_at,reviewed_by";

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
    const body: unknown = await request.json();
    const catalogInput = catalogServiceSchema.safeParse(body);
    const db = createAdminClient();
    if (catalogInput.success) {
      const { data: catalog } = await db.from("national_service_codes").select("id,code,description").eq("id", catalogInput.data.nationalServiceCodeId).eq("active", true).maybeSingle();
      if (!catalog) return NextResponse.json({ error: "Serviço do catálogo não encontrado." }, { status: 404 });
      const { data: duplicate } = await db.from("service_templates").select(clientServiceSelect).eq("organization_id", session.organizationId).eq("national_service_code_id", catalog.id).maybeSingle();
      if (duplicate) return NextResponse.json({ service: duplicate, duplicate: true });
      const { data: organization } = await db.from("organizations").select("municipality_code").eq("id", session.organizationId).maybeSingle();
      let reusable: Record<string, unknown> | null = null;
      let reuseSource: "ORGANIZATION_PROVEN_CONFIGURATION" | "MUNICIPALITY_PROVEN_CONFIGURATION" | null = null;
      const { data: sameOrg } = await db.from("service_templates").select(reusableFiscalFields)
        .eq("organization_id", session.organizationId).eq("national_tax_code", catalog.code).in("workflow_status", ["REVIEWED", "AUTO_READY"]).eq("active", true).limit(1).maybeSingle();
      if (sameOrg && getServiceReadiness(sameOrg).ready) {
        reusable = sameOrg;
        reuseSource = "ORGANIZATION_PROVEN_CONFIGURATION";
      } else if (organization?.municipality_code) {
        // Municipal service classification (mapping, NBS code, ISS taxation) is a
        // property of the service item and municipality, not of the taxpayer, so a
        // configuration the office already reviewed for another company in the same
        // municipality is safe evidence to reuse — this never fabricates a
        // classification, it only widens whose prior human review counts as proof.
        const { data: municipalityOrgs } = await db.from("organizations").select("id").eq("municipality_code", organization.municipality_code);
        const municipalityOrgIds = (municipalityOrgs ?? []).map((item) => item.id);
        if (municipalityOrgIds.length) {
          const { data: sameMunicipality } = await db.from("service_templates").select(reusableFiscalFields)
            .in("organization_id", municipalityOrgIds).eq("national_tax_code", catalog.code).in("workflow_status", ["REVIEWED", "AUTO_READY"]).eq("active", true).limit(1).maybeSingle();
          if (sameMunicipality && getServiceReadiness(sameMunicipality).ready) {
            reusable = sameMunicipality;
            reuseSource = "MUNICIPALITY_PROVEN_CONFIGURATION";
          }
        }
      }
      const now = new Date().toISOString();
      const values = reusable ? {
        ...reusable,
        workflow_status: "AUTO_READY",
        active: true,
        reviewed_at: null,
        reviewed_by: null,
        auto_ready_at: now,
        auto_ready_source: reuseSource,
      } : {
        national_service_code_id: catalog.id,
        national_tax_code: catalog.code,
        workflow_status: "PENDING_REVIEW",
        active: false,
        submitted_at: now,
      };
      const { data, error } = await db.from("service_templates").insert({ organization_id: session.organizationId, name: catalog.description.slice(0, 160), default_description: catalog.description, created_by: session.userId, created_via: "CATALOG", ...values }).select(clientServiceSelect).single();
      if (error || !data) throw error ?? new Error("CATALOG_SERVICE_CREATE_FAILED");
      await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, actor_type: "CLIENT", action: reusable ? "client_catalog_service_auto_ready" : "client_catalog_service_needs_review", entity: "service_template", entity_id: data.id, safe_metadata: { source: "NATIONAL_SERVICE_CATALOG" } });
      return NextResponse.json({ service: data, autoReady: Boolean(reusable) }, { status: 201 });
    }
    const input = clientServiceFieldsSchema.parse(body);
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
      actor_type: "CLIENT",
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
      await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, actor_type: "CLIENT", action: "client_service_submitted_for_review", entity: "service_template", entity_id: input.id, safe_metadata: {} });
      return NextResponse.json({ service: data });
    }
    const update = buildClientServiceUpdate(record, input, now);
    if (!update.changed) return NextResponse.json({ service: clientServiceResponse(current as unknown as Record<string, unknown>) });
    const { data, error } = await db.from("service_templates").update({ ...update.values, updated_at: now })
      .eq("id", input.id).eq("organization_id", session.organizationId).select(clientServiceSelect).single();
    if (error || !data) throw error ?? new Error("CLIENT_SERVICE_UPDATE_FAILED");
    await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, actor_type: "CLIENT", action: "client_service_updated", entity: "service_template", entity_id: input.id, safe_metadata: {} });
    if (update.reviewReset) await db.from("audit_logs").insert({ organization_id: session.organizationId, actor_user_id: session.userId, actor_type: "CLIENT", action: "service_review_reset", entity: "service_template", entity_id: input.id, safe_metadata: { reason: "client_material_change" } });
    return NextResponse.json({ service: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Revise as informações do serviço." : "Não foi possível atualizar o serviço." }, { status: 422 });
  }
}
