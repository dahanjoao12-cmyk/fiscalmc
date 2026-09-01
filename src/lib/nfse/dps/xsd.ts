import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateXML } from "xmllint-wasm";

const schemaDirectory=join(process.cwd(),"schemas","nfse","production-restricted");
const mainSchema="DPS_v1.01.xsd";

export type DpsXsdValidation={valid:boolean;errors:string[]};
type SafeRuntimeDiagnostic={name:string;message:string;code?:string|number};
export class DpsXsdRuntimeError extends Error{
  constructor(public readonly code:"SCHEMA_DIRECTORY_READ_FAILED"|"SCHEMA_MAIN_NOT_FOUND"|"SCHEMA_PRELOAD_FAILED"|"WASM_VALIDATE_FAILED"|"WASM_MINIMAL_VALIDATE_FAILED",public readonly diagnostic?:SafeRuntimeDiagnostic){super(code);this.name="DpsXsdRuntimeError";}
}

/** Validates with the official DPS_v1.01 XSD and its bundled relative includes/imports. */
export async function validateDpsXml(xml:string):Promise<DpsXsdValidation>{
  const schemas=await loadDpsSchemas();
  const schema=schemas.find(file=>file.fileName===mainSchema);
  if(!schema)throw new DpsXsdRuntimeError("SCHEMA_MAIN_NOT_FOUND");
  let result:Awaited<ReturnType<typeof validateXML>>;
  try{result=await validateXML({xml:[{fileName:"dps.xml",contents:xml}],schema:[schema],preload:schemas.filter(file=>file.fileName!==mainSchema),modifyArguments:args=>["--nonet",...args]});}
  catch(error){throw new DpsXsdRuntimeError("WASM_VALIDATE_FAILED",safeRuntimeDiagnostic(error));}
  return {valid:result.valid,errors:result.errors.map(error=>safeValidationError(error.message,error.loc?.lineNumber))};
}

export async function validateXsdRuntimeProbe(){
  try{
    const result=await validateXML({xml:[{fileName:"probe.xml",contents:"<probe/>"}],schema:[{fileName:"probe.xsd",contents:'<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="probe" type="xs:string"/></xs:schema>'}],modifyArguments:args=>["--nonet",...args]});
    if(!result.valid)throw new Error("Validação mínima XSD inválida.");
  }catch(error){throw new DpsXsdRuntimeError("WASM_MINIMAL_VALIDATE_FAILED",safeRuntimeDiagnostic(error));}
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

function safeRuntimeDiagnostic(error:unknown):SafeRuntimeDiagnostic{
  const candidate=error instanceof Error?error:new Error("Erro não identificado do runtime XSD.");
  const code="code" in candidate&&(typeof candidate.code==="string"||typeof candidate.code==="number")?candidate.code:undefined;
  const message=candidate.message.replace(/(?:[A-Za-z]:)?[\\/][^\s'\"]+/g,"[path]").replace(/https?:\/\/[^\s'\"]+/g,"[url]").slice(0,300);
  return {name:candidate.name||"Error",message,code};
}
