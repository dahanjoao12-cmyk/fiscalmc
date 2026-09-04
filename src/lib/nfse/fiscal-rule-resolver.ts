import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { SafeFiscalError } from "./errors";
import { MunicipalParametersProvider,issPercentToBasisPoints,parseMunicipalServiceCode } from "./municipal-parameters/client";
import { MtlsHttpClient } from "./client/mtls-http-client";
import { OrganizationCertificateProvider } from "./certificate/organization-provider";
import { issRateSourceSchema, matchesAcceptedProductionDpsReference, type IssRateSource } from "./service-fiscal-reference";
import { issuerMunicipalRegistrationEmissionSchema } from "./fiscal-configuration";

const dpsTaxConfigurationSchema=z.object({iss:z.object({withholdingType:z.enum(["1","2","3"]),benefitNumber:z.string().min(1).optional()}),regime:z.object({simpleNational:z.enum(["1","2","3"]),simpleAssessment:z.enum(["1","2","3"]).optional(),special:z.enum(["0","1","2","3","4","5","6","9"])}),totalTaxes:z.object({indicator:z.literal("0")}),issuerMunicipalRegistrationEmission:issuerMunicipalRegistrationEmissionSchema.optional()});
const storedDpsTaxConfigurationSchema=z.union([dpsTaxConfigurationSchema,z.object({version:z.literal(1),form:z.unknown(),technical:dpsTaxConfigurationSchema.optional()})]);
export type FiscalResolutionInput={organizationId?:string;municipalityCode:string;nationalTaxCode:string;municipalServiceCode?:string|null;dpsMunicipalTaxCode?:string|null;nbsCode?:string|null;issTaxation?:"1"|"2"|"3"|"4"|null;issRateSource?:IssRateSource|null;fiscalReference?:unknown;taxRegime:"SIMPLES_NACIONAL"|"LUCRO_PRESUMIDO"|"LUCRO_REAL";reviewedAt?:string|null;serviceDate:string;dpsConfiguration:unknown};
export type FiscalResolution={municipalityCode:string;nationalTaxCode:string;municipalServiceCode?:string;iss:{taxation:"1"|"2"|"3"|"4";rateBasisPoints?:number;rateSource:IssRateSource;withholdingType:"1"|"2"|"3";source:"MUNICIPAL_INTEGRATION"|"ACCEPTED_PRODUCTION_DPS"};retention:{officialRulesChecked:boolean};dpsConfiguration:z.infer<typeof dpsTaxConfigurationSchema>;issuerMunicipalRegistrationEmission:"SEND"|"OMIT";source:"MUNICIPAL_PARAMETERS"|"ACCEPTED_PRODUCTION_DPS";validity:{validFrom:string;validUntil?:string}};

export async function resolveFiscalConfiguration(input:FiscalResolutionInput):Promise<FiscalResolution>{
  if(!input.reviewedAt)throw incomplete();
  let dpsConfiguration:z.infer<typeof dpsTaxConfigurationSchema>;
  try{const stored=storedDpsTaxConfigurationSchema.parse(input.dpsConfiguration);dpsConfiguration="version" in stored?(stored.technical??(() => {throw new Error("TECHNICAL_CONFIGURATION_PENDING");})()):stored;}
  catch{throw incomplete();}
  const issuerMunicipalRegistrationEmission=dpsConfiguration.issuerMunicipalRegistrationEmission?.mode??"SEND";
  const parsedRateSource=issRateSourceSchema.safeParse(input.issRateSource);
  if(!input.issTaxation||!parsedRateSource.success)throw incomplete();
  const issRateSource=parsedRateSource.data;
  if(issRateSource==="PARAMETRIZED_BY_NATIONAL"){
    if(!input.dpsMunicipalTaxCode||!matchesAcceptedProductionDpsReference(input.fiscalReference,{nationalTaxCode:input.nationalTaxCode,municipalTaxCode:input.dpsMunicipalTaxCode,nbsCode:input.nbsCode}))throw incomplete();
    const reference=input.fiscalReference as {referenceCompetence:string;issTaxation:string;issWithholding:string};
    if(reference.issTaxation!==input.issTaxation||reference.issWithholding!==dpsConfiguration.iss.withholdingType)throw incomplete();
    return{municipalityCode:input.municipalityCode,nationalTaxCode:input.nationalTaxCode,iss:{taxation:input.issTaxation,rateSource:issRateSource,withholdingType:dpsConfiguration.iss.withholdingType,source:"ACCEPTED_PRODUCTION_DPS"},retention:{officialRulesChecked:false},dpsConfiguration,issuerMunicipalRegistrationEmission,source:"ACCEPTED_PRODUCTION_DPS",validity:{validFrom:reference.referenceCompetence}};
  }
  if(!input.municipalServiceCode)throw new SafeFiscalError("FISCAL_SERVICE_MAPPING_MISSING","Uma configuração fiscal desta empresa precisa ser revisada pelo escritório antes da emissão.");
  const serviceCode=parseMunicipalServiceCode(input.municipalServiceCode);
  const admin=createAdminClient();
  const{data:cached}=await admin.from("municipal_tax_rules").select("incidence,iss_rate_percent,valid_from,valid_until").eq("municipality_code",input.municipalityCode).eq("service_code",serviceCode).lte("valid_from",`${input.serviceDate}T23:59:59Z`).or(`valid_until.is.null,valid_until.gte.${input.serviceDate}T00:00:00Z`).order("valid_from",{ascending:false}).limit(1).maybeSingle();
  // Real organizations never fall back to NFSE_CERT_PATH. Local smoke tests omit organizationId explicitly.
  const provider=input.organizationId?new MunicipalParametersProvider(new MtlsHttpClient(new OrganizationCertificateProvider()),undefined,input.organizationId):new MunicipalParametersProvider();
  const rule=cached??await fetchRule(input.municipalityCode,serviceCode,input.serviceDate,provider);
  await Promise.all([
    provider.getRetentions({municipalityCode:input.municipalityCode,competence:input.serviceDate}),
    ...(dpsConfiguration.regime.special!=="0"?[provider.getSpecialRegimes({municipalityCode:input.municipalityCode,serviceCode,competence:input.serviceDate})]:[]),
    ...(dpsConfiguration.iss.benefitNumber?[provider.getBenefit({municipalityCode:input.municipalityCode,benefitNumber:dpsConfiguration.iss.benefitNumber,competence:input.serviceDate})]:[]),
  ]);
  if(rule.incidence!=="SIM"||rule.iss_rate_percent===null)throw incomplete();
  return{municipalityCode:input.municipalityCode,nationalTaxCode:input.nationalTaxCode,municipalServiceCode:serviceCode,iss:{taxation:input.issTaxation,rateBasisPoints:issPercentToBasisPoints(Number(rule.iss_rate_percent)),rateSource:issRateSource,withholdingType:dpsConfiguration.iss.withholdingType,source:"MUNICIPAL_INTEGRATION"},retention:{officialRulesChecked:true},dpsConfiguration,issuerMunicipalRegistrationEmission,source:"MUNICIPAL_PARAMETERS",validity:{validFrom:rule.valid_from,...(rule.valid_until?{validUntil:rule.valid_until}:{})}};
}

function incomplete(){return new SafeFiscalError("FISCAL_CONFIGURATION_INCOMPLETE","Uma configuração fiscal desta empresa precisa ser revisada pelo escritório antes da emissão.");}
async function fetchRule(municipalityCode:string,serviceCode:string,competence:string,provider:MunicipalParametersProvider){
  const response=await provider.getAliquota({municipalityCode,serviceCode,competence});
  const item=response.aliquotas[serviceCode].find(value=>!value.DtFim||value.DtFim>=`${competence}T00:00:00`)??response.aliquotas[serviceCode][0];
  const row={municipality_code:municipalityCode,service_code:serviceCode,incidence:item.Incidencia,iss_rate_percent:item.Aliq,valid_from:item.DtIni,valid_until:item.DtFim,source:"ADN_PRODUCTION_RESTRICTED",source_version:null,fetched_at:new Date().toISOString()};
  const{error}=await createAdminClient().from("municipal_tax_rules").upsert(row,{onConflict:"municipality_code,service_code,incidence,valid_from,source"});
  if(error)throw new SafeFiscalError("MUNICIPAL_PARAMETERS_INVALID","Não foi possível registrar os parâmetros municipais.");
  return{incidence:row.incidence,iss_rate_percent:row.iss_rate_percent,valid_from:row.valid_from,valid_until:row.valid_until};
}
