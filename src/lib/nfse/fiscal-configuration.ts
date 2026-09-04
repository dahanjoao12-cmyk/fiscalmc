import { z } from "zod";

export const administrativeRegimeSchema=z.enum(["SIMPLES_NACIONAL","LUCRO_PRESUMIDO","LUCRO_REAL"]);
export const reviewValueSchema=z.enum(["CONFIGURED","PENDING_REVIEW","NOT_APPLICABLE"]);
export const issuerMunicipalRegistrationEmissionSchema=z.object({
  mode:z.enum(["SEND","OMIT"]),
  source:z.literal("SEFIN_REJECTION"),
  referenceDps:z.string().trim().min(1).max(40),
  referenceCode:z.string().trim().min(1).max(40),
  environment:z.literal("PRODUCTION_RESTRICTED"),
}).strict();
export const fiscalConfigurationFormSchema=z.object({
  taxRegime:administrativeRegimeSchema.nullable(),
  simplesNational:reviewValueSchema,
  mei:reviewValueSchema,
  issConfiguration:reviewValueSchema,
  issWithholding:reviewValueSchema,
  specialRegime:reviewValueSchema,
  ibsCbs:reviewValueSchema
});
export type FiscalConfigurationForm=z.infer<typeof fiscalConfigurationFormSchema>;
export type FiscalConfigurationStatus="DRAFT"|"PENDING_REVIEW"|"REVIEWED"|"INVALID";
export const fiscalTechnicalConfigurationSchema=z.object({
  opSimpNac:z.enum(["1","2","3"]),
  regApTribSN:z.enum(["1","2","3"]).nullable(),
  regEspTrib:z.enum(["0","1","2","3","4","5","6","9"]),
  issWithholdingType:z.enum(["1","2","3"]),
  issuerMunicipalRegistrationEmission:issuerMunicipalRegistrationEmissionSchema.optional(),
});
export type FiscalTechnicalConfiguration=z.infer<typeof fiscalTechnicalConfigurationSchema>;
type StoredConfiguration={version:1;form:FiscalConfigurationForm;technical?:unknown};

export const emptyFiscalConfiguration: FiscalConfigurationForm={taxRegime:null,simplesNational:"PENDING_REVIEW",mei:"PENDING_REVIEW",issConfiguration:"PENDING_REVIEW",issWithholding:"PENDING_REVIEW",specialRegime:"PENDING_REVIEW",ibsCbs:"PENDING_REVIEW"};

function storedConfiguration(value:unknown):StoredConfiguration|undefined{
  const parsed=z.object({version:z.literal(1),form:fiscalConfigurationFormSchema,technical:z.unknown().optional()}).safeParse(value);
  return parsed.success?parsed.data:undefined;
}

export function readFiscalConfiguration(value:unknown):FiscalConfigurationForm{
  return storedConfiguration(value)?.form??emptyFiscalConfiguration;
}

export function normalizeFiscalConfiguration(form:FiscalConfigurationForm,existing:unknown,technicalInput?:FiscalTechnicalConfiguration){
  const prior=storedConfiguration(existing);
  const priorTechnical=z.object({issuerMunicipalRegistrationEmission:issuerMunicipalRegistrationEmissionSchema.optional()}).safeParse(prior?.technical).data;
  const technical=technicalInput?{
    iss:{withholdingType:technicalInput.issWithholdingType},
    regime:{simpleNational:technicalInput.opSimpNac,...(technicalInput.regApTribSN?{simpleAssessment:technicalInput.regApTribSN}:{}) ,special:technicalInput.regEspTrib},
    totalTaxes:{indicator:"0" as const},
    ...(priorTechnical?.issuerMunicipalRegistrationEmission?{issuerMunicipalRegistrationEmission:priorTechnical.issuerMunicipalRegistrationEmission}:{}),
  }:prior?.technical??(isLegacyTechnicalConfiguration(existing)?existing:undefined);
  return {version:1 as const,form,...(technical===undefined?{}:{technical})};
}

function isLegacyTechnicalConfiguration(value:unknown){
  return z.object({iss:z.unknown(),regime:z.unknown(),totalTaxes:z.unknown()}).safeParse(value).success;
}

export function getFiscalConfigurationReadiness(profile:{tax_regime:string|null;dps_configuration:unknown;reviewed_at:string|null;reviewed_by:string|null}|null){
  if(!profile)return {status:"DRAFT" as const,missing:["Regime tributário","Opção pelo Simples","MEI","Configuração de ISS","Retenção de ISS","Regime especial","IBS/CBS"],form:emptyFiscalConfiguration,technical:null,reviewedAt:null,reviewedBy:null};
  const parsed=z.object({version:z.literal(1),form:fiscalConfigurationFormSchema,technical:z.unknown().optional()}).safeParse(profile.dps_configuration);
  if(!parsed.success)return {status:"INVALID" as const,missing:["Estrutura da configuração fiscal"],form:emptyFiscalConfiguration,technical:null,reviewedAt:profile.reviewed_at,reviewedBy:profile.reviewed_by};
  const form=parsed.data.form;
  const missing:string[]=[];
  if(!profile.tax_regime||form.taxRegime!==profile.tax_regime)missing.push("Regime tributário");
  if(form.simplesNational==="PENDING_REVIEW")missing.push("Opção pelo Simples");
  if(form.mei==="PENDING_REVIEW")missing.push("Enquadramento MEI");
  if(form.issConfiguration==="PENDING_REVIEW")missing.push("Configuração de ISS");
  if(form.issWithholding==="PENDING_REVIEW")missing.push("Retenção de ISS");
  if(form.specialRegime==="PENDING_REVIEW")missing.push("Regime especial");
  if(form.ibsCbs==="PENDING_REVIEW")missing.push("IBS/CBS");
  const status: FiscalConfigurationStatus=missing.length?"PENDING_REVIEW":profile.reviewed_at?"REVIEWED":"PENDING_REVIEW";
  const technical=parsed.data.technical;
  const technicalRecord=technical as {regime?:{simpleNational?:unknown;simpleAssessment?:unknown;special?:unknown};iss?:{withholdingType?:unknown};issuerMunicipalRegistrationEmission?:unknown}|undefined;
  const technicalForm=fiscalTechnicalConfigurationSchema.safeParse({
    opSimpNac:technicalRecord?.regime?.simpleNational,
    regApTribSN:technicalRecord?.regime?.simpleAssessment??null,
    regEspTrib:technicalRecord?.regime?.special,
    issWithholdingType:technicalRecord?.iss?.withholdingType,
    issuerMunicipalRegistrationEmission:technicalRecord?.issuerMunicipalRegistrationEmission,
  });
  return {status,missing,form,technical:technicalForm.success?technicalForm.data:null,reviewedAt:profile.reviewed_at,reviewedBy:profile.reviewed_by};
}
