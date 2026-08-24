export type NFSeEnvironment = "PRODUCTION_RESTRICTED" | "PRODUCTION";
export type InvoiceStatus = "DRAFT" | "READY" | "SUBMITTING" | "ISSUED" | "REJECTED" | "UNKNOWN" | "CANCELLED";

export type FiscalDocumentDomain = {
  organizationId: string;
  issuer: { taxId: string; municipalRegistration: string; municipalityCode: string };
  customer: { taxId: string; name: string };
  service: { nationalTaxCode: string; municipalServiceCode?: string; description: string };
  amountCents: number;
  serviceDate: string;
  dps: { series: string; number: bigint; identifier: string };
};

export type IssueRequest = { document: FiscalDocumentDomain; idempotencyKey: string; scenario?: "success" | "rejection" | "timeout" };
export type IssueResult = { status: "ISSUED"; accessKey: string; nfseNumber: string; officialXml: string } | { status: "REJECTED"; code: string; safeMessage: string; technicalMessage: string } | { status: "UNKNOWN"; dpsIdentifier: string; safeMessage: string };

export interface NFSeProvider {
  issue(input: IssueRequest): Promise<IssueResult>;
  getByAccessKey(accessKey: string): Promise<IssueResult | null>;
  getByDpsIdentifier(identifier: string): Promise<IssueResult | null>;
  getMunicipalParameters(municipalityCode: string, serviceCode: string): Promise<Record<string, unknown>>;
}
