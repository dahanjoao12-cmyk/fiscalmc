import { describe,expect,it } from "vitest";
import { emptyFiscalConfiguration,getFiscalConfigurationReadiness,normalizeFiscalConfiguration } from "@/lib/nfse/fiscal-configuration";

describe("fiscal configuration readiness",()=>{
  it("mantém dados desconhecidos em revisão pendente",()=>{
    const readiness=getFiscalConfigurationReadiness(null);
    expect(readiness.status).toBe("DRAFT");
    expect(readiness.form.issWithholding).toBe("PENDING_REVIEW");
    expect(readiness.missing).toContain("Retenção de ISS");
  });
  it("salvar rascunho não marca a revisão",()=>{
    const configuration=normalizeFiscalConfiguration({...emptyFiscalConfiguration,taxRegime:"SIMPLES_NACIONAL"},{});
    const readiness=getFiscalConfigurationReadiness({tax_regime:"SIMPLES_NACIONAL",dps_configuration:configuration,reviewed_at:null,reviewed_by:null});
    expect(readiness.status).toBe("PENDING_REVIEW");
    expect(readiness.reviewedAt).toBeNull();
  });
  it("uma revisão completa não libera o restante da emissão",()=>{
    const form={taxRegime:"LUCRO_REAL" as const,simplesNational:"NOT_APPLICABLE" as const,mei:"NOT_APPLICABLE" as const,issConfiguration:"CONFIGURED" as const,issWithholding:"CONFIGURED" as const,specialRegime:"NOT_APPLICABLE" as const,ibsCbs:"NOT_APPLICABLE" as const};
    const readiness=getFiscalConfigurationReadiness({tax_regime:"LUCRO_REAL",dps_configuration:normalizeFiscalConfiguration(form,{}),reviewed_at:"2026-08-26T12:00:00.000Z",reviewed_by:"user"});
    expect(readiness.status).toBe("REVIEWED");
    expect(readiness.missing).toEqual([]);
  });
  it("reconhece estrutura inválida sem assumir valores",()=>{
    const readiness=getFiscalConfigurationReadiness({tax_regime:"LUCRO_REAL",dps_configuration:{unknown:true},reviewed_at:null,reviewed_by:null});
    expect(readiness.status).toBe("INVALID");
    expect(readiness.missing).toContain("Estrutura da configuração fiscal");
  });
});
