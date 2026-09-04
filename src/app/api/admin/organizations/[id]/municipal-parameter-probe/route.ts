import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIssuanceContext } from "@/lib/auth/session";
import { MunicipalParametersProvider, parseMunicipalServiceCode } from "@/lib/nfse/municipal-parameters/client";
import { MtlsHttpClient } from "@/lib/nfse/client/mtls-http-client";
import { OrganizationCertificateProvider } from "@/lib/nfse/certificate/organization-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const organizationIdSchema = z.string().uuid();
const querySchema = z.object({
  municipalServiceCode: z.string(),
  competence: z.iso.date(),
});

/**
 * Office-only, read-only probe for an already known municipal API service
 * code. It never writes a mapping, creates an invoice, reserves a DPS number
 * or calls the SEFIN emission endpoint.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: organizationId } = await params;
    if (!organizationIdSchema.safeParse(organizationId).success) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    const session = await requireIssuanceContext(organizationId);
    if (session.actorType !== "OFFICE") {
      return NextResponse.json({ error: "Acesso do escritório necessário." }, { status: 403 });
    }

    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      return NextResponse.json({ error: "Revise o código municipal e a competência." }, { status: 400 });
    }
    const municipalServiceCode = parseMunicipalServiceCode(query.data.municipalServiceCode);

    const { data: organization } = await createAdminClient()
      .from("organizations")
      .select("municipality_code")
      .eq("id", organizationId)
      .maybeSingle();
    if (!organization) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    const parameters = new MunicipalParametersProvider(
      new MtlsHttpClient(new OrganizationCertificateProvider()),
      undefined,
      organizationId,
    );
    const [convention, retentions, aliquota] = await Promise.all([
      parameters.getConvention(organization.municipality_code),
      parameters.getRetentions({ municipalityCode: organization.municipality_code, competence: query.data.competence }),
      parameters.getAliquota({ municipalityCode: organization.municipality_code, serviceCode: municipalServiceCode, competence: query.data.competence }),
    ]);
    const rates = aliquota.aliquotas[municipalServiceCode] ?? [];
    if (!rates.length) {
      return NextResponse.json({ error: "A API oficial não retornou parâmetros para este código municipal." }, { status: 422 });
    }

    const retentionMatches = (retentions.retencoes.retencoesMunicipais ?? []).flatMap((retention) =>
      (retention.servicos ?? [])
        .filter((service) => service.codigoCompleto === municipalServiceCode)
        .map(() => ({ types: retention.tiposRetencao ?? [], validFrom: retention.dataInicioVigencia, validUntil: retention.dataFimVigencia })),
    );

    return NextResponse.json({
      municipalServiceCode,
      competence: query.data.competence,
      convention: { httpStatus: 200, available: Boolean(convention) },
      retentions: {
        httpStatus: 200,
        articleSixthEnabled: retentions.retencoes.artigoSexto.habilitado,
        matchingRules: retentionMatches,
      },
      aliquota: {
        httpStatus: 200,
        items: rates.map((rate) => ({ incidence: rate.Incidencia, rate: rate.Aliq, validFrom: rate.DtIni, validUntil: rate.DtFim })),
      },
      transmissionAttempted: false,
      sequenceConsumed: false,
      invoiceCreated: false,
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "MUNICIPAL_PARAMETER_PROBE_FAILED";
    console.error("MUNICIPAL_PARAMETER_PROBE_FAILED", { code });
    return NextResponse.json({ error: "Não foi possível consultar os parâmetros municipais.", code }, { status: 422 });
  }
}
