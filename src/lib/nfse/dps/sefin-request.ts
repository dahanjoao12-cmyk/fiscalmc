import { z } from "zod";
import { encodeDpsForSefin } from "./encoding";

const sefinRequestSchema=z.object({dpsXmlGZipB64:z.string().min(1)});
export type SefinDpsRequest=z.infer<typeof sefinRequestSchema>;
export const SEFIN_PRODUCTION_RESTRICTED_NFSE_URL="https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse";

/** Builds the exact OpenAPI v1 body for POST /nfse. It never performs the POST. */
export function buildSefinDpsRequest(signedXml:string):SefinDpsRequest{return sefinRequestSchema.parse({dpsXmlGZipB64:encodeDpsForSefin(signedXml)});}
