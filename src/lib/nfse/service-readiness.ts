import type { ServiceWorkflowStatus } from "@/lib/services/workflow";
import { issRateSourceSchema, matchesAcceptedProductionDpsReference } from "./service-fiscal-reference";

export type ServiceReadinessInput = {
  active: boolean;
  workflow_status: ServiceWorkflowStatus;
  national_service_code_id: string | null;
  national_tax_code: string | null;
  municipal_service_code: string | null;
  municipal_service_mapping_id: string | null;
  dps_municipal_tax_code: string | null;
  dps_municipal_tax_code_source: string | null;
  service_location_municipality_code: string | null;
  nbs_code?: string | null;
  iss_taxation?: string | null;
  iss_rate_source?: string | null;
  fiscal_reference?: unknown;
  reviewed_at: string | null;
  reviewed_by?: string | null;
};

export function getServiceTechnicalReadiness(service: ServiceReadinessInput) {
  const missing: string[] = [];
  if (!service.national_service_code_id || !service.national_tax_code) missing.push("Código nacional");
  const acceptedReference = matchesAcceptedProductionDpsReference(service.fiscal_reference, {
    nationalTaxCode: service.national_tax_code ?? "",
    municipalTaxCode: service.dps_municipal_tax_code ?? "",
    nbsCode: service.nbs_code,
  });
  if (
    (!service.municipal_service_mapping_id || !service.municipal_service_code)
    && !(acceptedReference && service.iss_rate_source === "PARAMETRIZED_BY_NATIONAL")
  ) {
    missing.push("De/para municipal");
  }
  if (!service.dps_municipal_tax_code) missing.push("Código DPS municipal");
  if (service.dps_municipal_tax_code && !service.dps_municipal_tax_code_source) missing.push("Fonte do código DPS municipal");
  if (!service.service_location_municipality_code) missing.push("Município de prestação");
  if (!service.nbs_code) missing.push("Código NBS");
  if (!/^[1-4]$/.test(service.iss_taxation ?? "")) missing.push("Tributação do ISS");
  if (!issRateSourceSchema.safeParse(service.iss_rate_source).success) missing.push("Origem da alíquota do ISS");
  return { missing, ready: missing.length === 0 };
}

export function getServiceReadiness(service: ServiceReadinessInput) {
  const technical = getServiceTechnicalReadiness(service);
  const missing = [...technical.missing];
  if (service.workflow_status === "REVIEWED" && (!service.reviewed_at || !service.reviewed_by)) missing.push("Revisão fiscal");
  if (service.workflow_status === "REVIEWED" && !service.active) missing.push("Serviço ativo");
  const ready = service.workflow_status === "REVIEWED"
    && service.active
    && Boolean(service.reviewed_at && service.reviewed_by)
    && technical.ready;
  return { status: service.workflow_status, missing, ready, technicalReady: technical.ready };
}
