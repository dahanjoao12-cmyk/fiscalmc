import type { IssueRequest, IssueResult, NFSeProvider } from "../types";

const issued = new Map<string, IssueResult>();

export class MockNFSeProvider implements NFSeProvider {
  async issue(input: IssueRequest): Promise<IssueResult> {
    const previous = issued.get(input.idempotencyKey);
    if (previous) return previous;
    if (input.scenario === "rejection") return { status:"REJECTED", code:"MOCK-FISCAL-001", safeMessage:"A emissão precisa de revisão do escritório.", technicalMessage:"Mock rejection: municipal tax configuration mismatch" };
    if (input.scenario === "timeout") return { status:"UNKNOWN", dpsIdentifier:input.document.dps.identifier, safeMessage:"A solicitação foi recebida, mas ainda não foi possível confirmar a emissão. Não tente emitir novamente; estamos consultando o resultado." };
    const result: IssueResult = { status:"ISSUED", accessKey:`MOCK${input.document.dps.identifier}`.padEnd(50,"0").slice(0,50), nfseNumber:input.document.dps.number.toString(), officialXml:`<?xml version="1.0" encoding="UTF-8"?><MockNFSe semValidadeFiscal="true" id="${input.document.dps.identifier}"/>` };
    issued.set(input.idempotencyKey, result);
    return result;
  }
  async getByAccessKey(accessKey: string) { return [...issued.values()].find((item) => item.status === "ISSUED" && item.accessKey === accessKey) ?? null; }
  async getByDpsIdentifier(identifier: string) { return [...issued.values()].find((item) => item.status === "UNKNOWN" ? item.dpsIdentifier === identifier : item.status === "ISSUED" && item.accessKey.includes(identifier)) ?? null; }
  async getMunicipalParameters(municipalityCode: string, serviceCode: string) { return { mock:true, municipalityCode, serviceCode, expiresInSeconds:3600 }; }
}
