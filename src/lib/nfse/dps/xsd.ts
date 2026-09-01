import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";

const schemaDirectory=join(process.cwd(),"schemas","nfse","production-restricted");
const mainSchema="DPS_v1.01.xsd";

export type DpsXsdValidation={valid:boolean;errors:string[]};
export class DpsXsdRuntimeError extends Error{
  constructor(public readonly code:"SCHEMA_DIRECTORY_READ_FAILED"|"SCHEMA_MAIN_NOT_FOUND"|"SCHEMA_PRELOAD_FAILED"|"WASM_VALIDATE_FAILED"){super(code);this.name="DpsXsdRuntimeError";}
}

/** Validates with the official DPS_v1.01 XSD and its bundled relative includes/imports. */
export async function validateDpsXml(xml:string):Promise<DpsXsdValidation>{
  const schemas=await loadDpsSchemas();
  const schema=schemas.find(file=>file.fileName===mainSchema);
  if(!schema)throw new DpsXsdRuntimeError("SCHEMA_MAIN_NOT_FOUND");
  let result:Awaited<ReturnType<typeof validateXML>>;
  try{result=await validateXML({xml:[{fileName:"dps.xml",contents:xml}],schema:[schema],preload:schemas.filter(file=>file.fileName!==mainSchema),modifyArguments:args=>["--nonet",...args]});}
  catch{throw new DpsXsdRuntimeError("WASM_VALIDATE_FAILED");}
  return {valid:result.valid,errors:result.errors.map(error=>safeValidationError(error.message,error.loc?.lineNumber))};
}

export async function listDpsSchemaFiles(){
  try{return (await readdir(schemaDirectory)).filter(file=>file.endsWith(".xsd")).sort();}
  catch{throw new DpsXsdRuntimeError("SCHEMA_DIRECTORY_READ_FAILED");}
}

async function loadDpsSchemas(){
  const files=await listDpsSchemaFiles();
  try{return await Promise.all(files.map(async file=>({fileName:file,contents:await readFile(join(schemaDirectory,file),"utf8")})));}
  catch{throw new DpsXsdRuntimeError("SCHEMA_PRELOAD_FAILED");}
}

function safeValidationError(message:string,lineNumber:number|undefined){
  const redacted=message.replace(/'[^']*'/g,"'[redacted]'").replace(/\"[^\"]*\"/g,'"[redacted]"').trim();
  return lineNumber?`Linha ${lineNumber}: ${redacted}`:redacted;
}
