import { describe, expect, it } from "vitest";
import { buildFiscalDocument } from "@/lib/nfse/issuance/domain";

describe("documento fiscal", () => {
  it("monta em memória a DPS nº 2 sem reservar sequência ou chamar a SEFIN", () => {
    const document = buildFiscalDocument({
      organization: { id: "moreira", taxId: "40241895000170", municipalRegistration: "1234567", municipalityCode: "3304557" },
      customer: { taxId: "68644533000140", legalName: "ORLA RIO CONCESSIONARIA LTDA." },
      service: { nationalTaxCode: "171901", municipalServiceCode: "001" },
      taxConfiguration: { regime: "SIMPLES_NACIONAL", taxationType: "MUNICIPAL", iss: { withheld: false, source: "OFFICE_PARAMETER" }, ibsCbs: { customerFieldsEnabled: false } },
      amountCents: 10_000,
      serviceDate: "2026-09-02",
      description: "Serviços contábeis - emissão de homologação",
      dpsSeries: "00001",
      dpsNumber: 2n,
    });

    expect(document.amountCents).toBe(10_000);
    expect(document.serviceDate).toBe("2026-09-02");
    expect(document.dps.identifier).toBe("DPS330455724024189500017000001000000000000002");
  });
});
