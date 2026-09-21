import { describe,expect,it } from "vitest";
import { resolveFiscalConfiguration } from "@/lib/nfse/fiscal-rule-resolver";

const fiscalReference={source:"ACCEPTED_PRODUCTION_DPS" as const,referenceNFse:"398",referenceDps:"395",referenceCompetence:"2026-09-02",cTribNac:"171901",cTribMun:"001",cNbs:"113022100",issTaxation:"1" as const,issWithholding:"1" as const};
const technical={iss:{withholdingType:"1" as const},regime:{simpleNational:"3" as const,simpleAssessment:"1" as const,special:"0" as const},totalTaxes:{indicator:"0" as const}};

function resolve(dpsConfiguration:unknown){
  return resolveFiscalConfiguration({organizationId:"moreira",municipalityCode:"3304557",nationalTaxCode:"171901",municipalServiceCode:"001",dpsMunicipalTaxCode:"001",nbsCode:"113022100",issTaxation:"1",issRateSource:"PARAMETRIZED_BY_NATIONAL",fiscalReference,taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-04T00:00:00.000Z",serviceDate:"2026-09-02",dpsConfiguration});
}

describe("isento e imune dispensam o código municipal",()=>{
  it("resolve alíquota zero sem código municipal quando isento",async()=>{
    const result=await resolveFiscalConfiguration({organizationId:"clinica",municipalityCode:"4314902",nationalTaxCode:"040301",municipalServiceCode:null,dpsMunicipalTaxCode:null,nbsCode:"123011300",issTaxation:"3",issRateSource:"EMITTER_PROVIDED",fiscalReference:{},taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-21T00:00:00.000Z",serviceDate:"2026-09-21",dpsConfiguration:{version:1,form:{},technical}});
    expect(result.iss.taxation).toBe("3");
    expect(result.iss.rateBasisPoints).toBe(0);
    expect(result.municipalServiceCode).toBeUndefined();
  });
  it("resolve sem código municipal quando imune, sem definir alíquota para parametrização nacional",async()=>{
    const result=await resolveFiscalConfiguration({organizationId:"clinica",municipalityCode:"4314902",nationalTaxCode:"040301",municipalServiceCode:null,dpsMunicipalTaxCode:null,nbsCode:"123011300",issTaxation:"4",issRateSource:"PARAMETRIZED_BY_NATIONAL",fiscalReference:{},taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-21T00:00:00.000Z",serviceDate:"2026-09-21",dpsConfiguration:{version:1,form:{},technical}});
    expect(result.iss.taxation).toBe("4");
    expect(result.iss.rateBasisPoints).toBeUndefined();
  });
  it("ainda exige o código municipal (ou uma alíquota manual citada) quando o serviço é tributável",async()=>{
    await expect(resolveFiscalConfiguration({organizationId:"clinica",municipalityCode:"4314902",nationalTaxCode:"040301",municipalServiceCode:null,dpsMunicipalTaxCode:null,nbsCode:"123011300",issTaxation:"1",issRateSource:"EMITTER_PROVIDED",fiscalReference:{},taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-21T00:00:00.000Z",serviceDate:"2026-09-21",dpsConfiguration:{version:1,form:{},technical}})).rejects.toMatchObject({code:"FISCAL_SERVICE_MAPPING_MISSING"});
  });
});

describe("alíquota manual do escritório, informada na emissão",()=>{
  it("aceita a alíquota manual quando não há código municipal, desde que citada",async()=>{
    const result=await resolveFiscalConfiguration({organizationId:"clinica",municipalityCode:"4314902",nationalTaxCode:"040101",municipalServiceCode:null,dpsMunicipalTaxCode:null,nbsCode:"123011300",issTaxation:"1",issRateSource:"EMITTER_PROVIDED",fiscalReference:{},taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-21T00:00:00.000Z",serviceDate:"2026-09-21",dpsConfiguration:{version:1,form:{},technical},manualRateBasisPoints:200,manualRateSourceNote:"LC 966/2022, Tabela XII, item 4.01 — Porto Alegre/RS"});
    expect(result.iss.rateBasisPoints).toBe(200);
    expect(result.iss.source).toBe("OFFICE_PARAMETER");
    expect(result.source).toBe("OFFICE_PARAMETER");
    expect(result.manualRateSourceNote).toBe("LC 966/2022, Tabela XII, item 4.01 — Porto Alegre/RS");
  });
  it("rejeita a alíquota manual sem a fonte citada",async()=>{
    await expect(resolveFiscalConfiguration({organizationId:"clinica",municipalityCode:"4314902",nationalTaxCode:"040101",municipalServiceCode:null,dpsMunicipalTaxCode:null,nbsCode:"123011300",issTaxation:"1",issRateSource:"EMITTER_PROVIDED",fiscalReference:{},taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-21T00:00:00.000Z",serviceDate:"2026-09-21",dpsConfiguration:{version:1,form:{},technical},manualRateBasisPoints:200,manualRateSourceNote:"  "})).rejects.toMatchObject({code:"FISCAL_SERVICE_MAPPING_MISSING"});
  });
});

describe("regra de emissão da IM do prestador",()=>{
  it("usa OMIT apenas quando o perfil contém a evidência E0120",async()=>{
    const result=await resolve({version:1,form:{},technical:{...technical,issuerMunicipalRegistrationEmission:{mode:"OMIT",source:"SEFIN_REJECTION",referenceDps:"4",referenceCode:"E0120",environment:"PRODUCTION_RESTRICTED"}}});
    expect(result.issuerMunicipalRegistrationEmission).toBe("OMIT");
  });
  it("mantém SEND como padrão seguro quando não há regra específica",async()=>{
    const result=await resolve({version:1,form:{},technical});
    expect(result.issuerMunicipalRegistrationEmission).toBe("SEND");
  });
});
