import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseXml } from "libxmljs2";

const schemaDirectory=join(process.cwd(),"schemas","nfse","production-restricted");

export type DpsXsdValidation={valid:boolean;errors:string[]};

/** Validates with the official DPS_v1.01 XSD and its bundled relative includes/imports. */
export async function validateDpsXml(xml:string):Promise<DpsXsdValidation>{
  const [schemaText]=await Promise.all([readFile(join(schemaDirectory,"DPS_v1.01.xsd"),"utf8")]);
  const schema=parseXml(schemaText,{baseUrl:`file:///${schemaDirectory.replace(/\\/g,"/")}/`,nonet:true});
  const document=parseXml(xml,{nonet:true});
  const valid=document.validate(schema);
  return {valid,errors:document.validationErrors.map(error=>error.message.trim())};
}
