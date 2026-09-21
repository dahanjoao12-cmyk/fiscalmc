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
  it("não exige o código DPS municipal — opcional na DPS nacional", () => {
    const readiness = getServiceReadiness({ ...complete, dps_municipal_tax_code: null, dps_municipal_tax_code_source: null });
    expect(readiness.ready).toBe(true);
    expect(readiness.missing).not.toContain("Código DPS municipal");
  });
  it("dispensa o de/para municipal quando o serviço é isento ou imune", () => {
    const isento = getServiceReadiness({ ...complete, iss_taxation: "3", municipal_service_mapping_id: null, municipal_service_code: null });
    expect(isento.ready).toBe(true);
    expect(isento.missing).not.toContain("De/para municipal");
    const imune = getServiceReadiness({ ...complete, iss_taxation: "4", municipal_service_mapping_id: null, municipal_service_code: null });
    expect(imune.ready).toBe(true);
    expect(imune.missing).not.toContain("De/para municipal");
  });
  it("aprova um serviço sem de/para municipal — a alíquota é resolvida na emissão, não no cadastro", () => {
    const readiness = getServiceReadiness({ ...complete, municipal_service_mapping_id: null, municipal_service_code: null });
    expect(readiness.ready).toBe(true);
    expect(readiness.missing).not.toContain("De/para municipal");
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
  it("permite AUTO_READY somente com a mesma configuração técnica completa", () => {
    expect(getServiceReadiness({ ...complete, workflow_status: "AUTO_READY", reviewed_at: null, reviewed_by: null }).ready).toBe(true);
    expect(getServiceReadiness({ ...complete, workflow_status: "AUTO_READY", reviewed_at: null, reviewed_by: null, nbs_code: null }).ready).toBe(false);
  });
  it("só torna um serviço pronto quando ativo, revisado e auditável", () => {
    expect(getServiceReadiness(complete).ready).toBe(true);
    expect(getServiceReadiness({ ...complete, active: false }).ready).toBe(false);
    expect(getServiceReadiness({ ...complete, reviewed_by: null }).ready).toBe(false);
  });
});
