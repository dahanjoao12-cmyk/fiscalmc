import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

export const clientServiceSelect = "id,name,default_description,client_service_location,client_note,needs_info_message,workflow_status,submitted_at,created_at,updated_at";
const reusableFiscalFields = "national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,nbs_code,iss_taxation,iss_rate_source,fiscal_reference,active,workflow_status,reviewed_at,reviewed_by";

/**
 * Creates a service_template from a national catalog code, reusing a prior
 * office-reviewed configuration for the same organization or municipality
 * when one exists. When allowAutoReady is false, a match still requires
 * office review — used for company-secondary activities, which must always
 * go through review regardless of a proven configuration existing.
 */
export async function createServiceFromNationalCode(input: {
  db: SupabaseClient;
  organizationId: string;
  nationalServiceCodeId: string;
  createdBy: string;
  actorType: "OFFICE" | "CLIENT";
  allowAutoReady: boolean;
}): Promise<{ service: Record<string, unknown>; autoReady: boolean; duplicate: boolean } | { error: "NOT_FOUND" }> {
  const { db, organizationId, nationalServiceCodeId, createdBy, actorType, allowAutoReady } = input;
  const { data: catalog } = await db.from("national_service_codes").select("id,code,description").eq("id", nationalServiceCodeId).eq("active", true).maybeSingle();
  if (!catalog) return { error: "NOT_FOUND" };

  const { data: duplicate } = await db.from("service_templates").select(clientServiceSelect).eq("organization_id", organizationId).eq("national_service_code_id", catalog.id).maybeSingle();
  if (duplicate) return { service: duplicate, duplicate: true, autoReady: false };

  const { data: organization } = await db.from("organizations").select("municipality_code").eq("id", organizationId).maybeSingle();
  let reusable: Record<string, unknown> | null = null;
  let reuseSource: "ORGANIZATION_PROVEN_CONFIGURATION" | "MUNICIPALITY_PROVEN_CONFIGURATION" | null = null;
  if (allowAutoReady) {
    const { data: sameOrg } = await db.from("service_templates").select(reusableFiscalFields)
      .eq("organization_id", organizationId).eq("national_tax_code", catalog.code).in("workflow_status", ["REVIEWED", "AUTO_READY"]).eq("active", true).limit(1).maybeSingle();
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
  const { data, error } = await db.from("service_templates").insert({ organization_id: organizationId, name: catalog.description.slice(0, 160), default_description: catalog.description, created_by: createdBy, created_via: "CATALOG", ...values }).select(clientServiceSelect).single();
  if (error || !data) throw error ?? new Error("CATALOG_SERVICE_CREATE_FAILED");
  await db.from("audit_logs").insert({ organization_id: organizationId, actor_user_id: createdBy, actor_type: actorType, action: reusable ? `${actorType.toLowerCase()}_catalog_service_auto_ready` : `${actorType.toLowerCase()}_catalog_service_needs_review`, entity: "service_template", entity_id: data.id, safe_metadata: { source: "NATIONAL_SERVICE_CATALOG" } });
  return { service: data, autoReady: Boolean(reusable), duplicate: false };
}
