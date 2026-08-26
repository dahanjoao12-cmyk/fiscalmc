import { SafeFiscalError } from "../errors";

/** TSIdDPS do XSD v1.01: DPS + município + tipo inscrição + inscrição(14) + série(5) + número(15). */
export function buildDpsIdentifier(input:{municipalityCode:string;taxId:string;series:string;number:bigint}){
  if(!/^\d{7}$/.test(input.municipalityCode)||!/^\d{5}$/.test(input.series)||input.number<1n||input.number>999999999999999n)throw new SafeFiscalError("FISCAL_CONFIGURATION_INCOMPLETE","Os dados de identificação da DPS estão incompletos.");
  const taxId=input.taxId.replace(/\W/g,"").toUpperCase();
  if(!/^\d{11}$/.test(taxId)&&!/^[0-9A-Z]{14}$/.test(taxId))throw new SafeFiscalError("FISCAL_CONFIGURATION_INCOMPLETE","A inscrição federal do prestador é inválida para a DPS.");
  const type=taxId.length===14?"1":"2";
  return `DPS${input.municipalityCode}${type}${taxId.padStart(14,"0")}${input.series}${input.number.toString().padStart(15,"0")}`;
}
