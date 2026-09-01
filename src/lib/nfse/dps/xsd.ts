import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";

const schemaDirectory=join(process.cwd(),"schemas","nfse","production-restricted");
const mainSchema="DPS_v1.01.xsd";

export type DpsXsdValidation={valid:boolean;errors:string[]};

/** Validates with the official DPS_v1.01 XSD and its bundled relative includes/imports. */
export async function validateDpsXml(xml:string):Promise<DpsXsdValidation>{
  const files=(await readdir(schemaDirectory)).filter(file=>file.endsWith(".xsd"));
  const schemas=await Promise.all(files.map(async file=>({fileName:file,contents:await readFile(join(schemaDirectory,file),"utf8")})));
  const schema=schemas.find(file=>file.fileName===mainSchema);
  if(!schema)throw new Error("DPS XSD oficial não encontrado.");
  const result=await validateXML({xml:[{fileName:"dps.xml",contents:xml}],schema:[schema],preload:schemas.filter(file=>file.fileName!==mainSchema),modifyArguments:args=>["--nonet",...args]});
  return {valid:result.valid,errors:result.errors.map(error=>safeValidationError(error.message,error.loc?.lineNumber))};
}

function safeValidationError(message:string,lineNumber:number|undefined){
  const redacted=message.replace(/'[^']*'/g,"'[redacted]'").replace(/\"[^\"]*\"/g,'"[redacted]"').trim();
  return lineNumber?`Linha ${lineNumber}: ${redacted}`:redacted;
}
