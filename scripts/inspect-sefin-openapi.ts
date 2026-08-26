import { z } from "zod";
import { MtlsHttpClient } from "../src/lib/nfse/client/mtls-http-client";

const openApiUrl="https://sefin.producaorestrita.nfse.gov.br/SefinNacional/swagger/docs/v1";
const contractSchema=z.object({
  swagger:z.string(),
  info:z.object({title:z.string(),version:z.string()}),
  host:z.string(),
  basePath:z.string(),
  paths:z.object({
    "/nfse":z.object({post:z.object({consumes:z.array(z.string()),parameters:z.array(z.object({schema:z.object({$ref:z.string()})})),responses:z.record(z.string(),z.unknown())})}),
    "/dps/{id}":z.object({get:z.unknown()})
  }),
  definitions:z.object({NFSePostRequest:z.object({required:z.array(z.string()),properties:z.object({dpsXmlGZipB64:z.object({type:z.literal("string")})})})})
});

try{
  const response=await new MtlsHttpClient().getJson(openApiUrl);
  if(response.status!==200)throw Object.assign(new Error(`HTTP ${response.status}`),{code:"HTTP_ERROR"});
  const contract=contractSchema.parse(response.body);
  const post=contract.paths["/nfse"].post;
  console.log(JSON.stringify({url:openApiUrl,title:contract.info.title,version:contract.info.version,baseUrl:`https://${contract.host}${contract.basePath}`,postNfse:{body:contract.definitions.NFSePostRequest.required,contentType:post.consumes,responses:Object.keys(post.responses)}},null,2));
}catch(error){
  const value=error as {name?:string;code?:string;message?:string};
  console.error(JSON.stringify({error:{name:value.name,code:value.code,message:value.message}},null,2));
  process.exitCode=1;
}
