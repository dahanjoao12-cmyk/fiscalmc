import type { FiscalDocumentDomain } from "../types";
import { buildDpsIdentifier } from "../dps/identifier";

export function buildFiscalDocument(input: { organization:{id:string;taxId:string;municipalRegistration:string;municipalityCode:string}; customer:{taxId?:string|null;legalName:string}; service:{nationalTaxCode:string;municipalServiceCode?:string|null}; taxConfiguration:FiscalDocumentDomain["taxConfiguration"]; amountCents:number; serviceDate:string; description:string; dpsNumber:bigint; dpsSeries:string }): FiscalDocumentDomain {
  return {
    organizationId: input.organization.id,
    issuer: { taxId:input.organization.taxId, municipalRegistration:input.organization.municipalRegistration, municipalityCode:input.organization.municipalityCode },
    customer: { taxId:input.customer.taxId ?? undefined, name:input.customer.legalName },
    service: { nationalTaxCode:input.service.nationalTaxCode, municipalServiceCode:input.service.municipalServiceCode ?? undefined, description:input.description },
    taxConfiguration: input.taxConfiguration,
    amountCents:input.amountCents,
    serviceDate:input.serviceDate,
    dps:{ series:input.dpsSeries, number:input.dpsNumber, identifier:buildDpsIdentifier({municipalityCode:input.organization.municipalityCode,taxId:input.organization.taxId,series:input.dpsSeries,number:input.dpsNumber}) }
  };
}
