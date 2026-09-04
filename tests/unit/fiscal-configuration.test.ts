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
  it("persiste os códigos técnicos confirmados separados do status de revisão",()=>{
    const form={taxRegime:"SIMPLES_NACIONAL" as const,simplesNational:"CONFIGURED" as const,mei:"NOT_APPLICABLE" as const,issConfiguration:"CONFIGURED" as const,issWithholding:"CONFIGURED" as const,specialRegime:"CONFIGURED" as const,ibsCbs:"NOT_APPLICABLE" as const};
    const configuration=normalizeFiscalConfiguration(form,{}, {opSimpNac:"3",regApTribSN:"2",regEspTrib:"6",issWithholdingType:"1"});
    const readiness=getFiscalConfigurationReadiness({tax_regime:"SIMPLES_NACIONAL",dps_configuration:configuration,reviewed_at:null,reviewed_by:null});
    expect(readiness.technical).toEqual({opSimpNac:"3",regApTribSN:"2",regEspTrib:"6",issWithholdingType:"1"});
    expect(readiness.missing).toEqual([]);
  });
  it("preserva a regra auditável de omitir IM somente na DPS Nacional",()=>{
    const form={taxRegime:"SIMPLES_NACIONAL" as const,simplesNational:"CONFIGURED" as const,mei:"NOT_APPLICABLE" as const,issConfiguration:"CONFIGURED" as const,issWithholding:"CONFIGURED" as const,specialRegime:"CONFIGURED" as const,ibsCbs:"NOT_APPLICABLE" as const};
    const configuration={version:1 as const,form,technical:{iss:{withholdingType:"1" as const},regime:{simpleNational:"3" as const,simpleAssessment:"1" as const,special:"0" as const},totalTaxes:{indicator:"0" as const},issuerMunicipalRegistrationEmission:{mode:"OMIT" as const,source:"SEFIN_REJECTION" as const,referenceDps:"4",referenceCode:"E0120",environment:"PRODUCTION_RESTRICTED" as const}}};
    const readiness=getFiscalConfigurationReadiness({tax_regime:"SIMPLES_NACIONAL",dps_configuration:configuration,reviewed_at:"2026-09-04T00:00:00.000Z",reviewed_by:"office"});
    expect(readiness.status).toBe("REVIEWED");
    expect(readiness.technical).toMatchObject({issuerMunicipalRegistrationEmission:{mode:"OMIT",source:"SEFIN_REJECTION",referenceDps:"4",referenceCode:"E0120",environment:"PRODUCTION_RESTRICTED"}});
  });
  it("não apaga a regra de emissão da IM ao atualizar os demais campos técnicos",()=>{
    const form={taxRegime:"SIMPLES_NACIONAL" as const,simplesNational:"CONFIGURED" as const,mei:"NOT_APPLICABLE" as const,issConfiguration:"CONFIGURED" as const,issWithholding:"CONFIGURED" as const,specialRegime:"CONFIGURED" as const,ibsCbs:"NOT_APPLICABLE" as const};
    const existing={version:1 as const,form,technical:{iss:{withholdingType:"1" as const},regime:{simpleNational:"3" as const,simpleAssessment:"1" as const,special:"0" as const},totalTaxes:{indicator:"0" as const},issuerMunicipalRegistrationEmission:{mode:"OMIT" as const,source:"SEFIN_REJECTION" as const,referenceDps:"4",referenceCode:"E0120",environment:"PRODUCTION_RESTRICTED" as const}}};
    const updated=normalizeFiscalConfiguration(form,existing,{opSimpNac:"3",regApTribSN:"1",regEspTrib:"0",issWithholdingType:"1"});
    expect(getFiscalConfigurationReadiness({tax_regime:"SIMPLES_NACIONAL",dps_configuration:updated,reviewed_at:null,reviewed_by:null}).technical).toMatchObject({issuerMunicipalRegistrationEmission:{mode:"OMIT",referenceCode:"E0120"}});
  });
  it("reconhece estrutura inválida sem assumir valores",()=>{
    const readiness=getFiscalConfigurationReadiness({tax_regime:"LUCRO_REAL",dps_configuration:{unknown:true},reviewed_at:null,reviewed_by:null});
    expect(readiness.status).toBe("INVALID");
    expect(readiness.missing).toContain("Estrutura da configuração fiscal");
  });
});
