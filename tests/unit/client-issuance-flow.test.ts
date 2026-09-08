import { describe, expect, it } from "vitest";
import { canAdvanceClientIssuance, getCatalogSelectionOutcome, isEligibleClientIssuanceService, mergeCatalogPage } from "@/lib/issuance/client-flow";

describe("client issuance flow", () => {
  const complete = { hasCustomer: true, hasService: true, amount: "150,00", date: "2026-09-08", description: "Serviços contábeis" };

  it("only advances when the current step has its required data", () => {
    expect(canAdvanceClientIssuance({ ...complete, step: 0 })).toBe(true);
    expect(canAdvanceClientIssuance({ ...complete, step: 0, hasCustomer: false })).toBe(false);
    expect(canAdvanceClientIssuance({ ...complete, step: 1 })).toBe(true);
    expect(canAdvanceClientIssuance({ ...complete, step: 1, hasService: false })).toBe(false);
    expect(canAdvanceClientIssuance({ ...complete, step: 2 })).toBe(true);
    expect(canAdvanceClientIssuance({ ...complete, step: 2, description: "  " })).toBe(false);
  });

  it("keeps REVIEWED and technically complete AUTO_READY services eligible", () => {
    expect(isEligibleClientIssuanceService({ active: true, readiness: true, workflowStatus: "REVIEWED" })).toBe(true);
    expect(isEligibleClientIssuanceService({ active: true, readiness: true, workflowStatus: "AUTO_READY" })).toBe(true);
  });

  it("does not expose incomplete or inactive services to issuance", () => {
    expect(isEligibleClientIssuanceService({ active: true, readiness: false, workflowStatus: "AUTO_READY" })).toBe(false);
    expect(isEligibleClientIssuanceService({ active: false, readiness: true, workflowStatus: "REVIEWED" })).toBe(false);
    expect(isEligibleClientIssuanceService({ active: true, readiness: true, workflowStatus: "PENDING_REVIEW" })).toBe(false);
  });

  it("keeps catalog services selectable while only an auto-resolved service can advance", () => {
    const catalogService = { active: true, readiness: true, workflowStatus: "AUTO_READY" };
    const unresolvedCatalogService = { active: false, readiness: false, workflowStatus: "PENDING_REVIEW" };
    expect(isEligibleClientIssuanceService(catalogService)).toBe(true);
    expect(isEligibleClientIssuanceService(unresolvedCatalogService)).toBe(false);
  });

  it("only selects a catalog service for issuance when the existing workflow confirmed AUTO_READY", () => {
    expect(getCatalogSelectionOutcome({ autoReady: true, service: { id: "service-1", name: "Contabilidade" } })).toEqual({ ready: true, message: "Serviço pronto para emissão." });
    expect(getCatalogSelectionOutcome({ autoReady: false, service: { id: "service-2", name: "Outro serviço" } })).toEqual({
      ready: false,
      message: "Este serviço precisa de uma configuração antes de ser usado nesta nota.",
    });
  });

  it("keeps catalog search pages progressive and deduplicated beyond the first 16 results", () => {
    const firstPage = Array.from({ length: 16 }, (_, index) => ({ id: `service-${index + 1}` }));
    const secondPage = [{ id: "service-16" }, { id: "service-17" }];
    expect(mergeCatalogPage([], firstPage, 0)).toHaveLength(16);
    expect(mergeCatalogPage(firstPage, secondPage, 1).map((item) => item.id)).toEqual([...firstPage.map((item) => item.id), "service-17"]);
  });
});
