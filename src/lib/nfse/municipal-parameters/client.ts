import { z } from "zod";
import { getMunicipalParametersBaseUrl } from "../environments";
import { SafeFiscalError } from "../errors";
import { MtlsHttpClient } from "../client/mtls-http-client";

const serviceCodeSchema=z.string().regex(/^\d{2}\.\d{2}\.\d{2}\.\d{3}$/,"Código municipal deve ter o formato 00.00.00.000.");
const municipalityCodeSchema=z.string().regex(/^\d{7}$/);
const officialDateTimeSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,"Data oficial inválida.");
const aliquotaItemSchema=z.object({Incidencia:z.string().min(1),Aliq:z.coerce.number().finite().min(0).max(100),DtIni:officialDateTimeSchema,DtFim:officialDateTimeSchema.nullable()});
const aliquotaResponseSchema=z.object({aliquotas:z.record(serviceCodeSchema,z.array(aliquotaItemSchema).min(1)),mensagem:z.string()});
export type MunicipalServiceCode=z.infer<typeof serviceCodeSchema>; export type AliquotaResponse=z.infer<typeof aliquotaResponseSchema>; export type MunicipalApiResult={url:string;status:number;data:AliquotaResponse};
export const parseMunicipalServiceCode=(value:string):MunicipalServiceCode=>serviceCodeSchema.parse(value); export const issPercentToBasisPoints=(value:number)=>Math.round(value*100);

export class MunicipalParametersProvider {
  constructor(private readonly http=new MtlsHttpClient(),private readonly baseUrl=getMunicipalParametersBaseUrl()){}
  async getConvention(municipalityCode:string){const result=await this.http.getJson(`${this.baseUrl}/${municipalityCodeSchema.parse(municipalityCode)}/convenio`);if(result.status<200||result.status>=300)throw new SafeFiscalError("HTTP_ERROR","Não foi possível consultar os parâmetros municipais necessários.",result.status>=500);return z.record(z.string(),z.unknown()).parse(result.body);}
  async getAliquota(input:{municipalityCode:string;serviceCode:string;competence:string}){return (await this.getAliquotaWithMeta(input)).data;}
  async getAliquotaWithMeta(input:{municipalityCode:string;serviceCode:string;competence:string}):Promise<MunicipalApiResult>{const service=parseMunicipalServiceCode(input.serviceCode);if(!/^\d{4}-\d{2}-\d{2}$/.test(input.competence))throw new SafeFiscalError("MUNICIPAL_PARAMETERS_INVALID","A competência informada é inválida.");const result=await this.http.getJson(`${this.baseUrl}/${municipalityCodeSchema.parse(input.municipalityCode)}/${service}/${input.competence}/aliquota`);if(result.status<200||result.status>=300)throw new SafeFiscalError("HTTP_ERROR","Não foi possível consultar os parâmetros municipais necessários.",result.status>=500);try{return{url:result.url,status:result.status,data:aliquotaResponseSchema.parse(result.body)};}catch(error){if(error instanceof z.ZodError)throw new SafeFiscalError("INVALID_API_RESPONSE","Os parâmetros municipais recebidos estão em formato inválido.");throw error;}}
}
