import type { IssueRequest, NFSeProvider } from "../types";
import { SafeFiscalError } from "../errors";
import { buildSefinDpsRequest, type SefinDpsRequest } from "../dps/sefin-request";

/**
 * Adaptador deliberadamente bloqueado até a homologação com A1 real, XSD vigente e
 * contrato atual do Swagger. Não transforma exemplos ou schemas antigos em produção.
 */
export class NationalNFSeProvider implements NFSeProvider {
  /** Available for controlled preparation tests only; this class never transmits in this stage. */
  buildRequest(signedDpsXml:string):SefinDpsRequest{return buildSefinDpsRequest(signedDpsXml);}
  async issue(input: IssueRequest): Promise<never> { void input; throw new SafeFiscalError("NFSE_NATIONAL_NOT_HOMOLOGATED", "A integração nacional ainda não foi homologada para esta empresa."); }
  async getByAccessKey(accessKey: string): Promise<null> { void accessKey; return null; }
  async getByDpsIdentifier(identifier: string): Promise<null> { void identifier; return null; }
  async getMunicipalParameters(municipalityCode: string, serviceCode: string): Promise<Record<string, unknown>> { void municipalityCode; void serviceCode; throw new SafeFiscalError("NFSE_NATIONAL_NOT_HOMOLOGATED", "A consulta nacional ainda não foi homologada."); }
}
