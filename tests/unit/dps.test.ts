import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { describe,expect,it } from "vitest";
import { buildDpsIdentifier } from "@/lib/nfse/dps/identifier";
import { decodeDpsFromSefin,encodeDpsForSefin } from "@/lib/nfse/dps/encoding";
import { validateDpsXml,validateXsdRuntimeProbe } from "@/lib/nfse/dps/xsd";
import { assertDpsReadiness } from "@/lib/nfse/dps/readiness";

const fixturePath=new URL("../../fixtures/dps/minimal-valid-unsigned.xml",import.meta.url);
async function fixture(){return readFile(fixturePath,"utf8");}

describe("DPS v1.01",()=>{
  it("forma o identificador conforme TSIdDPS",()=>expect(buildDpsIdentifier({municipalityCode:"3304557",taxId:"12345678000195",series:"00001",number:1n})).toBe("DPS330455711234567800019500001000000000000001"));
  it("valida a fixture sanitizada contra o XSD oficial",async()=>expect((await validateDpsXml(await fixture())).valid).toBe(true));
  it("inicializa o runtime WASM com um XSD mínimo",async()=>await expect(validateXsdRuntimeProbe()).resolves.toBeUndefined());
  it("resolve os includes e imports oficiais da DPS",async()=>expect((await validateDpsXml(await fixture())).errors).toEqual([]));
  it("rejeita namespace incorreto",async()=>expect((await validateDpsXml((await fixture()).replace("http://www.sped.fazenda.gov.br/nfse","urn:invalid"))).valid).toBe(false));
  it("rejeita elemento obrigatório ausente",async()=>expect((await validateDpsXml((await fixture()).replace("<cLocEmi>3304557</cLocEmi>",""))).valid).toBe(false));
  it("rejeita elemento fora da ordem",async()=>expect((await validateDpsXml((await fixture()).replace("<serie>00001</serie><nDPS>1</nDPS>","<nDPS>1</nDPS><serie>00001</serie>"))).valid).toBe(false));
  it("rejeita código de serviço inválido sem expor o valor no erro",async()=>{const result=await validateDpsXml((await fixture()).replace("070201","invalid"));expect(result.valid).toBe(false);expect(result.errors.join(" ")).not.toContain("invalid");});
  it("rejeita data inválida",async()=>expect((await validateDpsXml((await fixture()).replace("2026-08-25","2026-99-99"))).valid).toBe(false));
  it("não depende de binding nativo",()=>expect(()=>createRequire(import.meta.url).resolve("libxmljs2")).toThrow());
  it("preserva XML em GZip/Base64",async()=>{const xml=await fixture();expect(decodeDpsFromSefin(encodeDpsForSefin(xml))).toBe(xml);});
  it("bloqueia prontidão DPS sem o código municipal de três dígitos",async()=>await expect(assertDpsReadiness({organization:{legalName:"Prestador",taxId:"12345678000195",municipalRegistration:"123",municipalityCode:"3304557",address:{street:"Rua",number:"1",neighborhood:"Centro",postalCode:"20000000",municipalityCode:"3304557",stateOrProvince:"RJ"}},service:{nationalTaxCode:"070201",municipalTaxCode:"07.02.01.001",locationMunicipalityCode:"3304557"},customer:{name:"Tomador",taxId:"52998224725"},fiscal:{regime:{simpleNational:"1",special:"0"},iss:{taxation:"1",withholding:"1",rateBasisPoints:500},totalTaxes:{indicator:"0"}},verifyCertificate:false})).rejects.toMatchObject({code:"FISCAL_CONFIGURATION_INCOMPLETE"}));
});
