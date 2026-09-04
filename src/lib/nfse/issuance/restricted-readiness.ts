import { SafeFiscalError } from "../errors";

export type RestrictedEmissionReadiness={
  registrationReady:boolean;
  fiscalReady:boolean;
  serviceReady:boolean;
  certificateReady:boolean;
  clientAccessReady:boolean;
  organizationStatus:string;
  emissionBlocked:boolean;
  environment:string|undefined;
  provider:string|undefined;
  productionEnabled:string|undefined;
  restrictedTransmissionEnabled:string|undefined;
};

/** Final, fail-closed gate. It only authorizes the restricted endpoint. */
export function assertRestrictedEmissionReady(input:RestrictedEmissionReadiness){
  const onboardingReady=input.registrationReady&&input.fiscalReady&&input.serviceReady&&input.certificateReady&&input.clientAccessReady;
  const restricted=input.environment?.toLowerCase()==="production_restricted"&&input.provider==="national";
  const productionBlocked=input.productionEnabled!=="true";
  const explicitlyAuthorized=input.restrictedTransmissionEnabled==="true";
  if(!onboardingReady||input.organizationStatus!=="ACTIVE"||input.emissionBlocked||!restricted||!productionBlocked||!explicitlyAuthorized){
    throw new SafeFiscalError("RESTRICTED_TRANSMISSION_NOT_AUTHORIZED","A transmissão em Produção Restrita ainda não foi autorizada para esta empresa.");
  }
  return{environment:"PRODUCTION_RESTRICTED" as const,productionBlocked:true};
}

/** Final fail-closed gate for either supported National environment. */
export function assertNationalEmissionReady(input:RestrictedEmissionReadiness){
  if(input.environment?.toLowerCase()!=="production")return assertRestrictedEmissionReady(input);
  const onboardingReady=input.registrationReady&&input.fiscalReady&&input.serviceReady&&input.certificateReady&&input.clientAccessReady;
  if(!onboardingReady||input.organizationStatus!=="ACTIVE"||input.emissionBlocked||input.provider!=="national"||input.productionEnabled!=="true"){
    throw new SafeFiscalError("PRODUCTION_TRANSMISSION_NOT_AUTHORIZED","A transmissão em Produção ainda não foi autorizada para esta empresa.");
  }
  return{environment:"PRODUCTION" as const,productionBlocked:false};
}
