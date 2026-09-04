import "server-only";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { OrganizationCertificateProvider } from "../certificate/organization-provider";
import { MtlsHttpClient } from "../client/mtls-http-client";
import { danfseEndpoints,endpoints } from "../environments";
import { SafeFiscalError } from "../errors";
import type { NFSeEnvironment } from "../types";

const dpsResponseSchema=z.union([
  z.object({chaveAcesso:z.string().regex(/^\d{50}$/)}).passthrough(),
  z.string().regex(/^\d{50}$/),
]);
const nfseResponseSchema=z.object({
  chaveAcesso:z.string().regex(/^\d{50}$/),
  nfseXmlGZipB64:z.string().min(1),
  dataHoraProcessamento:z.string().optional(),
}).passthrough();

export type OfficialReconciliationResult=
  |{status:"ISSUED";accessKey:string;nfseNumber:string;issuedAt?:string}
  |{status:"REJECTED";code:string;safeMessage:string}
  |{status:"UNKNOWN"};

export type OfficialNfseDocument={accessKey:string;nfseNumber:string;issuedAt?:string;xml:string};
export type OfficialDanfseDocument={pdf:Buffer;contentType:"application/pdf"}|null;

export interface UnknownInvoiceLookup{
  findByDps(input:{organizationId:string;dpsIdentifier:string}):Promise<OfficialReconciliationResult>;
}

function findScalar(value:unknown,key:string):string|undefined{
  if(!value||typeof value!=="object")return undefined;
  for(const [entryKey,entryValue] of Object.entries(value)){
    if(entryKey===key&&(typeof entryValue==="string"||typeof entryValue==="number"))return String(entryValue);
    const nested=findScalar(entryValue,key);if(nested)return nested;
  }
  return undefined;
}

/** Official read-only reconciliation client. It never exposes a local-certificate fallback. */
export class SefinRestrictedReconciliationClient implements UnknownInvoiceLookup{
  constructor(private readonly http=new MtlsHttpClient(new OrganizationCertificateProvider()),private readonly environment:NFSeEnvironment="PRODUCTION_RESTRICTED"){}
  async findByDps(input:{organizationId:string;dpsIdentifier:string}):Promise<OfficialReconciliationResult>{
    const dpsUrl=`${endpoints[this.environment]}/dps/${encodeURIComponent(input.dpsIdentifier)}`;
    const dpsResponse=await this.http.requestText({url:dpsUrl,organizationId:input.organizationId});
    if(dpsResponse.status===404)return{status:"UNKNOWN"};
    if(dpsResponse.status!==200)throw new SafeFiscalError("RECONCILIATION_UNAVAILABLE","Não foi possível confirmar a situação desta nota.",true);
    let dpsBody:unknown;try{dpsBody=JSON.parse(dpsResponse.body);}catch{dpsBody=dpsResponse.body.replace(/^"|"$/g,"");}
    const parsedDps=dpsResponseSchema.safeParse(dpsBody);
    if(!parsedDps.success)throw new SafeFiscalError("INVALID_API_RESPONSE","A resposta de reconciliação da SEFIN não corresponde ao contrato oficial.");
    const accessKey=typeof parsedDps.data==="string"?parsedDps.data:parsedDps.data.chaveAcesso;
    const document=await this.getNfseByAccessKey({organizationId:input.organizationId,accessKey});
    if(!document)return{status:"UNKNOWN"};
    return{status:"ISSUED",accessKey:document.accessKey,nfseNumber:document.nfseNumber,...(document.issuedAt?{issuedAt:document.issuedAt}:{})};
  }

  /** Reads a previously issued NFS-e from Produção Restrita. It never transmits a DPS. */
  async getNfseByAccessKey(input:{organizationId:string;accessKey:string}):Promise<OfficialNfseDocument|null>{
    const nfseUrl=`${endpoints[this.environment]}/nfse/${encodeURIComponent(input.accessKey)}`;
    const nfseResponse=await this.http.requestText({url:nfseUrl,organizationId:input.organizationId});
    if(nfseResponse.status===404)return null;
    if(nfseResponse.status!==200)throw new SafeFiscalError("RECONCILIATION_UNAVAILABLE","Não foi possível confirmar a situação desta nota.",true);
    let nfseBody:unknown;try{nfseBody=JSON.parse(nfseResponse.body);}catch{throw new SafeFiscalError("INVALID_API_RESPONSE","A resposta de consulta da NFS-e é inválida.");}
    const parsedNfse=nfseResponseSchema.safeParse(nfseBody);
    if(!parsedNfse.success||parsedNfse.data.chaveAcesso!==input.accessKey)throw new SafeFiscalError("INVALID_API_RESPONSE","A resposta de consulta da NFS-e é inconsistente.");
    let xml:string;try{xml=gunzipSync(Buffer.from(parsedNfse.data.nfseXmlGZipB64,"base64")).toString("utf8");}catch{throw new SafeFiscalError("INVALID_API_RESPONSE","O documento retornado pela SEFIN é inválido.");}
    const xmlObject=new XMLParser({ignoreAttributes:false}).parse(xml) as unknown;
    const nfseNumber=findScalar(xmlObject,"nNFSe");
    if(!nfseNumber)throw new SafeFiscalError("INVALID_API_RESPONSE","A NFS-e retornada não contém número oficial.");
    return{accessKey:input.accessKey,nfseNumber,xml,...(parsedNfse.data.dataHoraProcessamento?{issuedAt:parsedNfse.data.dataHoraProcessamento}:{})};
  }

  /** Retrieves only the official PDF; a 404 means DANFSe is not available yet. */
  async getDanfseByAccessKey(input:{organizationId:string;accessKey:string}):Promise<OfficialDanfseDocument>{
    const url=`${danfseEndpoints[this.environment]}/${encodeURIComponent(input.accessKey)}`;
    const response=await this.http.requestBuffer({url,organizationId:input.organizationId,headers:{accept:"application/pdf"}});
    if(response.status===404)return null;
    if(response.status!==200)throw new SafeFiscalError("DANFSE_UNAVAILABLE","Não foi possível recuperar o DANFSe oficial agora.",true);
    if(!response.contentType?.toLowerCase().startsWith("application/pdf")||!response.body.subarray(0,5).equals(Buffer.from("%PDF-")))throw new SafeFiscalError("INVALID_API_RESPONSE","O DANFSe retornado não corresponde a um PDF oficial.");
    return{pdf:response.body,contentType:"application/pdf"};
  }
}
