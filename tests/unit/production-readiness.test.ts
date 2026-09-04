import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints, getConfiguredNFSeEnvironment, getMunicipalParametersBaseUrl, getNFSeEnvironment } from "@/lib/nfse/environments";
import { SafeFiscalError } from "@/lib/nfse/errors";
import { assertNationalEmissionReady } from "@/lib/nfse/issuance/restricted-readiness";

const ready = {
  registrationReady: true, fiscalReady: true, serviceReady: true, certificateReady: true, clientAccessReady: true,
  organizationStatus: "ACTIVE", emissionBlocked: false, provider: "national", restrictedTransmissionEnabled: "true",
};

describe("readiness de Produção", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permite somente GETs de Produção quando a flag de transmissão continua bloqueada", () => {
    vi.stubEnv("NFSE_ENV", "production");
    vi.stubEnv("ENABLE_NFSE_PRODUCTION", "false");
    expect(getConfiguredNFSeEnvironment()).toBe("PRODUCTION");
    expect(endpoints.PRODUCTION).toBe("https://sefin.nfse.gov.br/SefinNacional");
    expect(endpoints.PRODUCTION_RESTRICTED).toBe("https://sefin.producaorestrita.nfse.gov.br/SefinNacional");
    expect(getMunicipalParametersBaseUrl("PRODUCTION")).toBe("https://adn.nfse.gov.br/parametrizacao");
    expect(() => getNFSeEnvironment()).toThrow("Produção fiscal está bloqueada");
  });

  it("não libera POST de Produção sem a flag explícita", () => {
    expect(() => assertNationalEmissionReady({ ...ready, environment: "production", productionEnabled: "false" })).toThrow(SafeFiscalError);
  });

  it("separa o gate de Produção da autorização restrita", () => {
    expect(assertNationalEmissionReady({ ...ready, environment: "production", productionEnabled: "true" })).toEqual({ environment: "PRODUCTION", productionBlocked: false });
  });
});
