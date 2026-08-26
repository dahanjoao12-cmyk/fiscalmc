import type { NFSeEnvironment } from "../types";

export function getNFSeEnvironment(): NFSeEnvironment {
  const value = process.env.NFSE_ENV?.toLowerCase();
  if (value === "production") {
    if (process.env.ENABLE_NFSE_PRODUCTION !== "true") throw new Error("Produção fiscal está bloqueada. Homologue antes e defina ENABLE_NFSE_PRODUCTION=true conscientemente.");
    return "PRODUCTION";
  }
  return "PRODUCTION_RESTRICTED";
}

export const endpoints = {
  PRODUCTION_RESTRICTED: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
  PRODUCTION: "https://sefin.nfse.gov.br/SefinNacional"
} as const;

export const municipalParametersEndpoints = { PRODUCTION_RESTRICTED: "https://adn.producaorestrita.nfse.gov.br/parametrizacao" } as const;
export function getMunicipalParametersBaseUrl() { if (getNFSeEnvironment() !== "PRODUCTION_RESTRICTED") throw new Error("Parâmetros municipais em Produção permanecem bloqueados."); return municipalParametersEndpoints.PRODUCTION_RESTRICTED; }
