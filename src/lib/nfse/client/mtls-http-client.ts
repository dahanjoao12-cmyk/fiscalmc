import https from "node:https";
import { LocalCertificateProvider } from "../certificate/local-provider";
import type { CertificateProvider } from "../certificate/provider";
export type MtlsResponse={url:string;status:number;body:unknown};
export type MtlsTextResponse={url:string;status:number;body:string};

/** Server-only HTTPS client. TLS peer verification is intentionally always enabled. */
export class MtlsHttpClient {
  constructor(private readonly certificateProvider:CertificateProvider=new LocalCertificateProvider()){}
  async requestText(input:{url:string;method?:"GET"|"POST";body?:string;headers?:Record<string,string>;organizationId?:string}):Promise<MtlsTextResponse>{
    const material=await this.certificateProvider.getCertificateMaterial({organizationId:input.organizationId});
    return new Promise<MtlsTextResponse>((resolve,reject)=>{
      const request=https.request(input.url,{method:input.method??"GET",cert:material.cert,key:material.key,rejectUnauthorized:true,headers:{accept:"application/json",...input.headers}},response=>{
        let text="";
        response.setEncoding("utf8");
        response.on("data",chunk=>text+=chunk);
        response.on("end",()=>resolve({url:input.url,status:response.statusCode??0,body:text}));
      });
      request.on("error",error=>reject(Object.assign(error,{code:"MTLS_HANDSHAKE_FAILED"})));
      if(input.body)request.write(input.body,"utf8");
      request.end();
    });
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
}
