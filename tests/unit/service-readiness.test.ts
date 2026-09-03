import { describe, expect, it } from "vitest";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

const complete = {
  active: true,
  workflow_status: "REVIEWED" as const,
  national_service_code_id: "national",
  national_tax_code: "17.19.01",
  municipal_service_code: "07.02.01.001",
  municipal_service_mapping_id: "mapping",
  dps_municipal_tax_code: "123",
  dps_municipal_tax_code_source: "Anexo técnico confirmado",
  service_location_municipality_code: "3304557",
  nbs_code: "113022100",
  iss_taxation: "1",
  iss_rate_source: "EMITTER_PROVIDED",
  reviewed_at: "2026-08-26T12:00:00.000Z",
  reviewed_by: "reviewer",
};

describe("service template readiness", () => {
  it("mantém código DPS desconhecido como pendência", () => {
    const readiness = getServiceReadiness({ ...complete, dps_municipal_tax_code: null });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("Código DPS municipal");
  });
  it("não aceita código municipal sem de/para selecionado", () => {
    const readiness = getServiceReadiness({ ...complete, municipal_service_mapping_id: null });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("De/para municipal");
  });
  it("aceita a referência de DPS de produção apenas no cenário parametrizado pelo Sistema Nacional", () => {
    const acceptedReference = {
      source: "ACCEPTED_PRODUCTION_DPS",
      referenceNFse: "398",
      referenceDps: "395",
      referenceCompetence: "2026-09-02",
      cTribNac: "171901",
      cTribMun: "001",
      cNbs: "113022100",
      issTaxation: "1",
      issWithholding: "1",
    };
    const service = {
      ...complete,
      national_tax_code: "171901",
      municipal_service_code: null,
      municipal_service_mapping_id: null,
      dps_municipal_tax_code: "001",
      nbs_code: "113022100",
      iss_rate_source: "PARAMETRIZED_BY_NATIONAL",
      fiscal_reference: acceptedReference,
    };
    expect(getServiceReadiness(service).ready).toBe(true);
    expect(getServiceReadiness({ ...service, iss_rate_source: "EMITTER_PROVIDED" }).ready).toBe(false);
  });
  it("exige a fonte do código DPS antes da revisão", () => {
    const readiness = getServiceReadiness({ ...complete, dps_municipal_tax_code_source: null });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("Fonte do código DPS municipal");
  });
  it("não considera pronto um serviço fora do workflow REVIEWED", () => {
    expect(getServiceReadiness({ ...complete, workflow_status: "PENDING_REVIEW", active: false, reviewed_at: null, reviewed_by: null }).ready).toBe(false);
    expect(getServiceReadiness({ ...complete, workflow_status: "NEEDS_INFO", active: false, reviewed_at: null, reviewed_by: null }).ready).toBe(false);
    expect(getServiceReadiness({ ...complete, workflow_status: "INACTIVE", active: false }).ready).toBe(false);
  });
  it("só torna um serviço pronto quando ativo, revisado e auditável", () => {
    expect(getServiceReadiness(complete).ready).toBe(true);
    expect(getServiceReadiness({ ...complete, active: false }).ready).toBe(false);
    expect(getServiceReadiness({ ...complete, reviewed_by: null }).ready).toBe(false);
  });
});
