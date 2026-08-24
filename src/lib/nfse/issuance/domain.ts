import type { FiscalDocumentDomain } from "../types";

export function buildFiscalDocument(input: { organizationId:string; amountCents:number; serviceDate:string; description:string; dpsNumber:bigint }): FiscalDocumentDomain {
  return {
    organizationId: input.organizationId,
    issuer: { taxId:"12ABC34501DE35", municipalRegistration:"123456", municipalityCode:"3550308" },
    customer: { taxId:"45DEF67801GH90", name:"Empresa ABC" },
    service: { nationalTaxCode:"010101", municipalServiceCode:"0101", description:input.description },
    amountCents:input.amountCents,
    serviceDate:input.serviceDate,
    dps:{ series:"00001", number:input.dpsNumber, identifier:`35503082${"12ABC34501DE35".padStart(14,"0")}00001${input.dpsNumber.toString().padStart(15,"0")}` }
  };
}
