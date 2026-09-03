import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOfficeSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/security/authorization";
import { getFiscalConfigurationReadiness } from "@/lib/nfse/fiscal-configuration";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";
import { getCertificateReadiness } from "@/lib/nfse/certificate/status";
import { createClientAccessService } from "@/lib/auth/client-access-service";
import { getOrganizationReadiness } from "@/lib/organizations/readiness";
import { buildFiscalDocument } from "@/lib/nfse/issuance/domain";
import { prepareRestrictedDps, type RestrictedDpsPreparationStage } from "@/lib/nfse/issuance/prepare-restricted-dps";
import { resolveFiscalConfiguration } from "@/lib/nfse/fiscal-rule-resolver";
import { decodeDpsFromSefin } from "@/lib/nfse/dps/encoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizationIdSchema = z.string().uuid();
const DRY_RUN_SERIES = "99999";
const DRY_RUN_NUMBER = 999999999999999n;
const digits = (value: string) => value.replace(/\D/g, "");
const operationSchema = z.object({
  customer: z.object({
    taxId: z.string().transform(digits).refine((value) => value.length === 14),
    legalName: z.string().trim().min(2).max(180),
    street: z.string().trim().min(2).max(120),
    addressNumber: z.string().trim().min(1).max(20),
    neighborhood: z.string().trim().min(2).max(100),
    postalCode: z.string().transform(digits).refine((value) => value.length === 8),
    municipalityCode: z.string().regex(/^\d{7}$/),
    state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  }).strict(),
  amountCents: z.number().int().positive(),
  competence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(5).max(2_000),
}).strict();
type PreflightStage = "AUTH" | "LOAD_CONFIGURATION" | "READINESS" | "FISCAL_RESOLUTION" | RestrictedDpsPreparationStage | "PAYLOAD_ASSERTION";

/**
 * Builds the exact restricted-environment payload in memory. This endpoint is
 * intentionally isolated from invoice creation, DPS sequence reservation and
 * NationalNFSeProvider.issue(), so it cannot transmit or change state.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let stage: PreflightStage = "AUTH";
  try {
    const session = await requireOfficeSession();
    if (!can(session.role, "invoice:issue")) return NextResponse.json({ error: "Acesso do escritório necessário." }, { status: 403 });

    const { id: organizationId } = await params;
    if (!organizationIdSchema.safeParse(organizationId).success) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    const operation = operationSchema.safeParse(await request.json());
    if (!operation.success) return NextResponse.json({ error: "Revise os dados da operação de teste." }, { status: 400 });

    stage = "LOAD_CONFIGURATION";
    const db = createAdminClient();
    const [organizationResult, profileResult, serviceResult, certificateResult, clientAccessResult] = await Promise.all([
      db.from("organizations").select("id,legal_name,tax_id,municipal_registration,municipality_code,postal_code,street,address_number,address_complement,neighborhood,state,email,phone").eq("id", organizationId).maybeSingle(),
      db.from("tax_profiles").select("tax_regime,dps_configuration,reviewed_at,reviewed_by").eq("organization_id", organizationId).maybeSingle(),
      db.from("service_templates").select("id,name,active,workflow_status,national_service_code_id,national_tax_code,municipal_service_code,municipal_service_mapping_id,dps_municipal_tax_code,dps_municipal_tax_code_source,service_location_municipality_code,nbs_code,iss_taxation,iss_rate_source,fiscal_reference,reviewed_at,reviewed_by").eq("organization_id", organizationId).eq("national_tax_code", "171901").eq("workflow_status", "REVIEWED").eq("active", true).maybeSingle(),
      db.from("digital_certificates").select("status,owner_tax_id,valid_until").eq("organization_id", organizationId).is("replaced_at", null).maybeSingle(),
      createClientAccessService(db).getSummary(organizationId),
    ]);
    const organization = organizationResult.data;
    const profile = profileResult.data;
    const service = serviceResult.data;
    if (!organization || !profile || !service) return NextResponse.json({ error: "A empresa não possui a configuração necessária para esta pré-validação." }, { status: 422 });

    stage = "READINESS";
    const fiscalReadiness = getFiscalConfigurationReadiness(profile);
    const serviceReadiness = getServiceReadiness(service);
    const certificateReadiness = getCertificateReadiness({ certificate: certificateResult.data, organizationTaxId: organization.tax_id });
    const organizationReadiness = getOrganizationReadiness({
      registration: { municipalRegistration: organization.municipal_registration, street: organization.street, addressNumber: organization.address_number, neighborhood: organization.neighborhood, state: organization.state },
      fiscal: { ready: fiscalReadiness.status === "REVIEWED", message: "" },
      services: { ready: serviceReadiness.ready, message: "" },
      certificate: { ready: certificateReadiness.ready, message: "" },
      clientAccess: clientAccessResult.readiness,
    });
    if (!organizationReadiness.overallReady || !fiscalReadiness.technical) {
      return NextResponse.json({ error: "A prontidão da empresa precisa estar completa antes da pré-validação.", readiness: readinessResponse(organizationReadiness) }, { status: 422 });
    }

    stage = "FISCAL_RESOLUTION";
    const fiscal = await resolveFiscalConfiguration({
      organizationId,
      municipalityCode: organization.municipality_code,
      nationalTaxCode: service.national_tax_code,
      municipalServiceCode: service.municipal_service_code,
      dpsMunicipalTaxCode: service.dps_municipal_tax_code,
      nbsCode: service.nbs_code,
      issTaxation: service.iss_taxation,
      issRateSource: service.iss_rate_source,
      fiscalReference: service.fiscal_reference,
      taxRegime: profile.tax_regime as "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL",
      reviewedAt: profile.reviewed_at,
      serviceDate: operation.data.competence,
      dpsConfiguration: profile.dps_configuration,
    });
    stage = "BUILD_DOCUMENT";
    const document = buildFiscalDocument({
      organization: { id: organization.id, taxId: organization.tax_id, municipalRegistration: organization.municipal_registration ?? "", municipalityCode: organization.municipality_code },
      customer: { taxId: operation.data.customer.taxId, legalName: operation.data.customer.legalName },
      service: { nationalTaxCode: service.national_tax_code, municipalServiceCode: service.dps_municipal_tax_code },
      taxConfiguration: { regime: profile.tax_regime as "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL", taxationType: "MUNICIPAL", iss: { withheld: false, source: "ACCEPTED_PRODUCTION_DPS" }, ibsCbs: { customerFieldsEnabled: false } },
      amountCents: operation.data.amountCents,
      serviceDate: operation.data.competence,
      description: operation.data.description,
      dpsNumber: DRY_RUN_NUMBER,
      dpsSeries: DRY_RUN_SERIES,
    });
    stage = "PREPARE_DPS";
    const prepared = await prepareRestrictedDps({
      organizationId,
      document,
      organization: {
        legalName: organization.legal_name,
        taxId: organization.tax_id,
        municipalRegistration: organization.municipal_registration ?? "",
        municipalityCode: organization.municipality_code,
        postalCode: organization.postal_code ?? "",
        street: organization.street ?? "",
        addressNumber: organization.address_number ?? "",
        addressComplement: organization.address_complement,
        neighborhood: organization.neighborhood ?? "",
        state: organization.state ?? "",
        email: organization.email,
        phone: organization.phone,
      },
      customer: { personType: "LEGAL_ENTITY", ...operation.data.customer, countryCode: "BR" },
      service: { nationalTaxCode: service.national_tax_code, dpsMunicipalTaxCode: service.dps_municipal_tax_code ?? "", nbsCode: service.nbs_code, locationMunicipalityCode: service.service_location_municipality_code ?? "" },
      fiscal: {
        regime: fiscal.dpsConfiguration.regime,
        iss: {
          taxation: fiscal.iss.taxation,
          withholding: fiscal.iss.withholdingType,
          rateSource: fiscal.iss.rateSource,
          ...(fiscal.iss.rateBasisPoints === undefined ? {} : { rateBasisPoints: fiscal.iss.rateBasisPoints }),
        },
        totalTaxes: fiscal.dpsConfiguration.totalTaxes,
      },
      onStage: (nextStage) => { stage = nextStage; },
    });
    stage = "PAYLOAD_ASSERTION";
    const signedXml = decodeDpsFromSefin(prepared.preparedPayload.dpsXmlGZipB64);
    const pAliqEmitted = signedXml.includes("<pAliq>");
    if (
      pAliqEmitted
      || prepared.model.service.nationalTaxCode !== "171901"
      || prepared.model.service.municipalTaxCode !== "001"
      || prepared.model.service.nbsCode !== "113022100"
      || prepared.model.service.location.municipalityCode !== "3304557"
      || prepared.model.fiscal.regime.simpleNational !== "3"
      || prepared.model.fiscal.regime.simpleAssessment !== "1"
      || prepared.model.fiscal.regime.special !== "0"
      || prepared.model.fiscal.iss.taxation !== "1"
      || prepared.model.fiscal.iss.withholding !== "1"
      || prepared.model.amountCents !== operation.data.amountCents
      || prepared.model.competence !== operation.data.competence
    ) {
      return NextResponse.json({ error: "A DPS de teste não corresponde ao cenário homologado." }, { status: 422 });
    }

    return NextResponse.json({
      readiness: readinessResponse(organizationReadiness),
      validation: { dpsBuilt: true, unsignedXsd: true, xmldsig: true, signatureVerification: true, signedXsd: true, gzipBase64: true, payload: true, pAliqEmitted: false },
      target: { environment: "PRODUCTION_RESTRICTED", method: "POST", contentType: "application/json", provider: "NATIONAL" },
      transmissionAttempted: false,
      sequenceConsumed: false,
      invoiceCreated: false,
    });
  } catch (error) {
    const upstreamCode = getSafeErrorCode(error);
    const errorName = error instanceof Error && /^[A-Za-z0-9_]{1,80}$/.test(error.name) ? error.name : "UnknownError";
    const code = `${stage}:${upstreamCode}`;
    console.error("EMISSION_PREFLIGHT_FAILED", { stage, upstreamCode, errorName });
    return NextResponse.json({ error: "A pré-validação da emissão não foi concluída.", code }, { status: 422 });
  }
}

function getSafeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)) return error.code;
  return "EMISSION_PREFLIGHT_FAILED";
}

function readinessResponse(readiness: ReturnType<typeof getOrganizationReadiness>) {
  return {
    registration: readiness.items.find((item) => item.key === "registration")?.ready ?? false,
    fiscal: readiness.items.find((item) => item.key === "fiscal")?.ready ?? false,
    service: readiness.items.find((item) => item.key === "services")?.ready ?? false,
    certificate: readiness.items.find((item) => item.key === "certificate")?.ready ?? false,
    clientAccess: readiness.items.find((item) => item.key === "clientAccess")?.ready ?? false,
    organization: readiness.overallReady,
  };
}
