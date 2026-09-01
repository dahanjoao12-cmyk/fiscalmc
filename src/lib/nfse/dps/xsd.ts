import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { ParseOption,XmlBufferInputProvider,XmlDocument,XmlValidateError,XsdValidator,xmlRegisterInputProvider } from "libxml2-wasm";

const schemaDirectory=join(process.cwd(),"schemas","nfse","production-restricted");
const mainSchema="DPS_v1.01.xsd";
const virtualSchemaBase="file:///fiscalmc-dps-schemas/";
const schemaProvider=new XmlBufferInputProvider({});
let schemaProviderRegistered=false;

export type DpsXsdValidation={valid:boolean;errors:string[]};
type SafeRuntimeDiagnostic={name:string;message:string;code?:string|number};
type DpsXsdRuntimeCode="SCHEMA_DIRECTORY_READ_FAILED"|"SCHEMA_MAIN_NOT_FOUND"|"SCHEMA_PRELOAD_FAILED"|"WASM_VALIDATE_FAILED"|"WASM_MINIMAL_VALIDATE_FAILED";

export class DpsXsdRuntimeError extends Error{
  constructor(public readonly code:DpsXsdRuntimeCode,public readonly diagnostic?:SafeRuntimeDiagnostic){super(code);this.name="DpsXsdRuntimeError";}
}

/** Validates with the official DPS_v1.01 XSD and bundled relative includes/imports, entirely offline. */
export async function validateDpsXml(xml:string):Promise<DpsXsdValidation>{
  const schemas=await loadDpsSchemas();
  const schema=schemas.find(file=>file.fileName===mainSchema);
  if(!schema)throw new DpsXsdRuntimeError("SCHEMA_MAIN_NOT_FOUND");
  registerOfficialSchemaProvider(schemas);
  let schemaDocument:XmlDocument|undefined;
  let dpsDocument:XmlDocument|undefined;
  let validator:XsdValidator|undefined;
  try{
    schemaDocument=XmlDocument.fromBuffer(Buffer.from(schema.contents),parseOptions(virtualSchemaUrl(schema.fileName)));
    validator=XsdValidator.fromDoc(schemaDocument);
    dpsDocument=XmlDocument.fromString(xml,parseOptions("file:///fiscalmc-dps-input/dps.xml"));
    validator.validate(dpsDocument);
    return {valid:true,errors:[]};
  }catch(error){
    if(error instanceof XmlValidateError)return {valid:false,errors:error.details.map(detail=>safeValidationError(detail.message,detail.line))};
    throw new DpsXsdRuntimeError("WASM_VALIDATE_FAILED",safeRuntimeDiagnostic(error));
  }finally{
    dpsDocument?.dispose();
    validator?.dispose();
    schemaDocument?.dispose();
  }
}

/** Minimal, isolated engine probe used by the authenticated certificate preflight. */
export async function validateXsdRuntimeProbe(){
  const result=validateMinimalXsd("<probe/>");
  if(!result.valid)throw new DpsXsdRuntimeError("WASM_MINIMAL_VALIDATE_FAILED");
}

/** Exported for tests to prove that the WebAssembly XSD engine rejects invalid input. */
export function validateMinimalXsd(xml:string):DpsXsdValidation{
  const schemaContents='<?xml version="1.0" encoding="UTF-8"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="probe" type="xs:string"/></xs:schema>';
  let schemaDocument:XmlDocument|undefined;
  let xmlDocument:XmlDocument|undefined;
  let validator:XsdValidator|undefined;
  try{
    schemaDocument=XmlDocument.fromString(schemaContents,parseOptions("file:///fiscalmc-xsd-probe/probe.xsd"));
    validator=XsdValidator.fromDoc(schemaDocument);
    xmlDocument=XmlDocument.fromString(xml,parseOptions("file:///fiscalmc-xsd-probe/probe.xml"));
    validator.validate(xmlDocument);
    return {valid:true,errors:[]};
  }catch(error){
    if(error instanceof XmlValidateError)return {valid:false,errors:error.details.map(detail=>safeValidationError(detail.message,detail.line))};
    throw new DpsXsdRuntimeError("WASM_MINIMAL_VALIDATE_FAILED",safeRuntimeDiagnostic(error));
  }finally{
    xmlDocument?.dispose();
    validator?.dispose();
    schemaDocument?.dispose();
  }
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

function registerOfficialSchemaProvider(schemas:Awaited<ReturnType<typeof loadDpsSchemas>>){
  for(const schema of schemas)schemaProvider.addBuffer(virtualSchemaUrl(schema.fileName),Buffer.from(schema.contents));
  if(!schemaProviderRegistered){
    if(!xmlRegisterInputProvider(schemaProvider))throw new DpsXsdRuntimeError("SCHEMA_PRELOAD_FAILED");
    schemaProviderRegistered=true;
  }
}

function virtualSchemaUrl(fileName:string){return `${virtualSchemaBase}${fileName}`;}
function parseOptions(url:string){return {url,option:ParseOption.XML_PARSE_NONET|ParseOption.XML_PARSE_NO_XXE};}

function safeValidationError(message:string,lineNumber:number|undefined){
  const redacted=message.replace(/(?:[A-Za-z]:)?[\\/][^\s'\"]+/g,"[path]").replace(/https?:\/\/[^\s'\"]+/g,"[url]").replace(/'[^']*'/g,"'[redacted]'").replace(/\"[^\"]*\"/g,'"[redacted]"').trim();
  return lineNumber?`Linha ${lineNumber}: ${redacted}`:redacted;
}

function safeRuntimeDiagnostic(error:unknown):SafeRuntimeDiagnostic{
  const candidate=error instanceof Error?error:new Error("Erro não identificado do runtime XSD.");
  const code="code" in candidate&&(typeof candidate.code==="string"||typeof candidate.code==="number")?candidate.code:undefined;
  const message=candidate.message.replace(/(?:[A-Za-z]:)?[\\/][^\s'\"]+/g,"[path]").replace(/https?:\/\/[^\s'\"]+/g,"[url]").slice(0,300);
  return {name:candidate.name||"Error",message,code};
}
