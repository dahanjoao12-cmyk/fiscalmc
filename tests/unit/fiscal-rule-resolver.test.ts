import { describe,expect,it } from "vitest";
import { resolveFiscalConfiguration } from "@/lib/nfse/fiscal-rule-resolver";

const fiscalReference={source:"ACCEPTED_PRODUCTION_DPS" as const,referenceNFse:"398",referenceDps:"395",referenceCompetence:"2026-09-02",cTribNac:"171901",cTribMun:"001",cNbs:"113022100",issTaxation:"1" as const,issWithholding:"1" as const};
const technical={iss:{withholdingType:"1" as const},regime:{simpleNational:"3" as const,simpleAssessment:"1" as const,special:"0" as const},totalTaxes:{indicator:"0" as const}};

function resolve(dpsConfiguration:unknown){
  return resolveFiscalConfiguration({organizationId:"moreira",municipalityCode:"3304557",nationalTaxCode:"171901",municipalServiceCode:"001",dpsMunicipalTaxCode:"001",nbsCode:"113022100",issTaxation:"1",issRateSource:"PARAMETRIZED_BY_NATIONAL",fiscalReference,taxRegime:"SIMPLES_NACIONAL",reviewedAt:"2026-09-04T00:00:00.000Z",serviceDate:"2026-09-02",dpsConfiguration});
}

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
