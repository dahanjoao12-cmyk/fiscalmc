import https from "node:https";
import { LocalCertificateProvider } from "../certificate/local-provider";
import type { CertificateProvider } from "../certificate/provider";
export type MtlsResponse={url:string;status:number;body:unknown};
export type MtlsTextResponse={url:string;status:number;body:string;contentType:string|undefined};
export type MtlsBinaryResponse={url:string;status:number;body:Buffer;contentType:string|undefined};
export type TransmissionDelivery="NOT_SENT"|"POSSIBLY_SENT";

export class MtlsRequestError extends Error{
  constructor(message:string,public readonly delivery:TransmissionDelivery,public readonly causeCode?:string){super(message);this.name="MtlsRequestError";}
}

/** Server-only HTTPS client. TLS peer verification is intentionally always enabled. */
export class MtlsHttpClient {
  constructor(private readonly certificateProvider:CertificateProvider=new LocalCertificateProvider()){}
  async requestBuffer(input:{url:string;method?:"GET"|"HEAD"|"POST";body?:string;headers?:Record<string,string>;organizationId?:string;trackDelivery?:boolean}):Promise<MtlsBinaryResponse>{
    const material=await this.certificateProvider.getCertificateMaterial({organizationId:input.organizationId});
    return new Promise<MtlsBinaryResponse>((resolve,reject)=>{
      let requestFinished=false;
      const rejectTracked=(message:string,causeCode?:string)=>input.trackDelivery?reject(new MtlsRequestError(message,requestFinished?"POSSIBLY_SENT":"NOT_SENT",causeCode)):reject(Object.assign(new Error(message),{code:causeCode??"MTLS_HANDSHAKE_FAILED"}));
      const request=https.request(input.url,{method:input.method??"GET",cert:material.cert,key:material.key,rejectUnauthorized:true,headers:{accept:"application/json",...input.headers}},response=>{
        const chunks:Buffer[]=[];
        response.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));
        response.on("end",()=>resolve({url:input.url,status:response.statusCode??0,body:Buffer.concat(chunks),contentType:typeof response.headers["content-type"]==="string"?response.headers["content-type"]:undefined}));
        response.on("aborted",()=>rejectTracked("A resposta foi encerrada antes da conclusão.","ECONNRESET"));
        response.on("error",error=>rejectTracked("Falha durante a leitura da resposta.",(error as NodeJS.ErrnoException).code));
      });
      request.once("finish",()=>{requestFinished=true;});
      request.on("error",error=>{
        const causeCode=typeof (error as NodeJS.ErrnoException).code==="string"?(error as NodeJS.ErrnoException).code:undefined;
        rejectTracked("Falha na comunicação mTLS.",causeCode);
      });
      request.setTimeout(30_000,()=>request.destroy(Object.assign(new Error("Tempo limite da comunicação mTLS."),{code:"ETIMEDOUT"})));
      if(input.body)request.write(input.body,"utf8");
      request.end();
    });
  }

  async requestText(input:{url:string;method?:"GET"|"HEAD"|"POST";body?:string;headers?:Record<string,string>;organizationId?:string;trackDelivery?:boolean}):Promise<MtlsTextResponse>{
    const response=await this.requestBuffer(input);
    return{...response,body:response.body.toString("utf8")};
  }

  async getJson(url:string,organizationId?:string):Promise<MtlsResponse>{
    const result=await this.requestText({url,organizationId});
    try{return{...result,body:JSON.parse(result.body)};}
    catch{throw Object.assign(new Error("JSON inválido."),{code:"INVALID_API_RESPONSE"});}
  }

  async postJson(url:string,body:unknown,organizationId?:string):Promise<MtlsResponse>{
    const result=await this.requestText({url,method:"POST",body:JSON.stringify(body),headers:{"content-type":"application/json"},organizationId});
    try{return{...result,body:JSON.parse(result.body)};}
    catch{throw Object.assign(new Error("JSON inválido."),{code:"INVALID_API_RESPONSE"});}
  }

  async postJsonTracked(url:string,body:unknown,organizationId:string):Promise<MtlsResponse>{
    const result=await this.requestText({url,method:"POST",body:JSON.stringify(body),headers:{"content-type":"application/json"},organizationId,trackDelivery:true});
    try{return{...result,body:JSON.parse(result.body)};}
    catch{throw new MtlsRequestError("Resposta JSON inválida após a transmissão.","POSSIBLY_SENT","INVALID_API_RESPONSE");}
  }
}
