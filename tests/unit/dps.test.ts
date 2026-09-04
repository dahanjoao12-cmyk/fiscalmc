import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { describe,expect,it } from "vitest";
import { buildDpsIdentifier } from "@/lib/nfse/dps/identifier";
import { decodeDpsFromSefin,encodeDpsForSefin } from "@/lib/nfse/dps/encoding";
import { validateDpsXml,validateMinimalXsd,validateXsdRuntimeProbe } from "@/lib/nfse/dps/xsd";
import { formatDpsDateTimeSaoPaulo } from "@/lib/nfse/dps/date-time";
import { assertDpsReadiness } from "@/lib/nfse/dps/readiness";
import { mapToDpsModel,type DpsModel } from "@/lib/nfse/dps/model";
import { buildDpsXml } from "@/lib/nfse/dps/xml";
import { getOrganizationReadiness } from "@/lib/organizations/readiness";

function modelWithIssuerMunicipalRegistration(emitMunicipalRegistration:boolean):DpsModel{
  return {
    id:"DPS330455724024189500017000001000000000000005",environment:"2" as const,emittedAt:"2026-09-02T12:00:00-03:00",applicationVersion:"test",series:"00001",number:5n,competence:"2026-09-02",issuingMunicipalityCode:"3304557",
    issuer:{taxId:"40241895000170",municipalRegistration:"0.191.068-0",emitMunicipalRegistration,name:"ASSESSORIA CONTABIL MOREIRA & CASTRO",address:{street:"Av. Rio Branco",number:"99",neighborhood:"Centro",postalCode:"20040004",municipalityCode:"3304557",stateOrProvince:"RJ",countryCode:"BR"}},
    customer:{taxId:"68644533000140",name:"ORLA RIO CONCESSIONARIA LTDA.",address:{street:"Do Joá",number:"3336",neighborhood:"Barra da Tijuca",postalCode:"22610141",municipalityCode:"3304557",stateOrProvince:"RJ",countryCode:"BR"}},
    service:{location:{municipalityCode:"3304557"},nationalTaxCode:"171901",municipalTaxCode:"001",nbsCode:"113022100",description:"Serviços contábeis - emissão de homologação"},amountCents:10000,
    fiscal:{regime:{simpleNational:"3",simpleAssessment:"1",special:"0"},iss:{taxation:"1",withholding:"1",rateSource:"PARAMETRIZED_BY_NATIONAL"},totalTaxes:{indicator:"0" as const}},
  };
}

const fixturePath=new URL("../../fixtures/dps/minimal-valid-unsigned.xml",import.meta.url);
async function fixture(){return readFile(fixturePath,"utf8");}

describe("DPS v1.01",()=>{
  it("forma o identificador conforme TSIdDPS",()=>expect(buildDpsIdentifier({municipalityCode:"3304557",taxId:"12345678000195",series:"00001",number:1n})).toBe("DPS330455721234567800019500001000000000000001"));
  it("identifica CPF como tipo 1 e preenche a inscrição federal à esquerda",()=>{
    const identifier=buildDpsIdentifier({municipalityCode:"3304557",taxId:"12345678901",series:"00001",number:1n});
    expect(identifier).toBe(["DPS","3304557","1","00012345678901","00001","000000000000001"].join(""));
    expect(identifier).toHaveLength(45);
  });
  it("identifica CNPJ numérico como tipo 2",()=>{
    const identifier=buildDpsIdentifier({municipalityCode:"3304557",taxId:"40241895000170",series:"00001",number:3n});
    expect(identifier).toBe(["DPS","3304557","2","40241895000170","00001","000000000000003"].join(""));
    expect(identifier).toHaveLength(45);
  });
  it("preserva o tipo 2 para CNPJ alfanumérico aceito pelo layout v1.01",()=>{
    const identifier=buildDpsIdentifier({municipalityCode:"3304557",taxId:"AB12CD34EF5629",series:"00001",number:4n});
    expect(identifier).toBe(["DPS","3304557","2","AB12CD34EF5629","00001","000000000000004"].join(""));
    expect(identifier).toHaveLength(45);
  });
  it("mantém série com cinco posições e número com quinze posições",()=>{
    const identifier=buildDpsIdentifier({municipalityCode:"3304557",taxId:"40241895000170",series:"00001",number:4n});
    expect(identifier.slice(25,30)).toBe("00001");
    expect(identifier.slice(30)).toBe("000000000000004");
  });
  it("valida a fixture sanitizada contra o XSD oficial",async()=>expect((await validateDpsXml(await fixture())).valid).toBe(true));
  it("inicializa o runtime WASM com um XSD mínimo",async()=>await expect(validateXsdRuntimeProbe()).resolves.toBeUndefined());
  it("rejeita XML inválido no XSD mínimo",()=>expect(validateMinimalXsd("<not-probe/>").valid).toBe(false));
  it("resolve os includes e imports oficiais da DPS",async()=>expect((await validateDpsXml(await fixture())).errors).toEqual([]));
  it("rejeita namespace incorreto",async()=>expect((await validateDpsXml((await fixture()).replace("http://www.sped.fazenda.gov.br/nfse","urn:invalid"))).valid).toBe(false));
  it("rejeita elemento obrigatório ausente",async()=>expect((await validateDpsXml((await fixture()).replace("<cLocEmi>3304557</cLocEmi>",""))).valid).toBe(false));
  it("rejeita elemento fora da ordem",async()=>expect((await validateDpsXml((await fixture()).replace("<serie>00001</serie><nDPS>1</nDPS>","<nDPS>1</nDPS><serie>00001</serie>"))).valid).toBe(false));
  it("rejeita código de serviço inválido sem expor o valor no erro",async()=>{const result=await validateDpsXml((await fixture()).replace("070201","invalid"));expect(result.valid).toBe(false);expect(result.errors.join(" ")).not.toContain("invalid");});
  it("rejeita data inválida",async()=>expect((await validateDpsXml((await fixture()).replace("2026-08-25","2026-99-99"))).valid).toBe(false));
  it("expõe a restrição XSD sem expor valores quando série e dhEmi são inválidos",async()=>{
    const xml=(await fixture()).replace("<dhEmi>2026-08-25T09:00:00-03:00</dhEmi>","<dhEmi>2026-09-02T12:00:00.000Z</dhEmi>").replace("<serie>00001</serie>","<serie>99999</serie>");
    const result=await validateDpsXml(xml);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("Elemento: dhEmi");
    expect(result.errors.join(" ")).toContain("Elemento: serie");
    expect(result.errors.join(" ")).toContain("Pattern esperado:");
    expect(result.errors.join(" ")).not.toContain("99999");
    expect(result.errors.join(" ")).not.toContain("2026-09-02T12:00:00.000Z");
  });
  it("aceita série de cinco dígitos compatível e dhEmi no formato oficial",async()=>{
    const xml=(await fixture()).replace("<dhEmi>2026-08-25T09:00:00-03:00</dhEmi>",`<dhEmi>${formatDpsDateTimeSaoPaulo(new Date("2026-09-02T12:00:00.000Z"))}</dhEmi>`).replace("<serie>00001</serie>","<serie>00000</serie>");
    await expect(validateDpsXml(xml)).resolves.toMatchObject({valid:true,errors:[]});
  });
  it("não depende de bindings nativos ou do runtime xmllint",()=>{const require=createRequire(import.meta.url);expect(()=>require.resolve("libxmljs2")).toThrow();expect(()=>require.resolve("xmllint-wasm")).toThrow();});
  it("preserva XML em GZip/Base64",async()=>{const xml=await fixture();expect(decodeDpsFromSefin(encodeDpsForSefin(xml))).toBe(xml);});
  it("omite pAliq quando a alíquota é parametrizada pelo Sistema Nacional",()=>{
    const model=mapToDpsModel({organizationId:"org",issuer:{taxId:"12345678000195",municipalRegistration:"123",municipalityCode:"3304557"},customer:{name:"Tomador"},service:{nationalTaxCode:"171901",description:"Contabilidade"},taxConfiguration:{regime:"SIMPLES_NACIONAL",taxationType:"MUNICIPAL",iss:{withheld:false,source:"ACCEPTED_PRODUCTION_DPS"},ibsCbs:{customerFieldsEnabled:false}},amountCents:1000,serviceDate:"2026-09-02",dps:{series:"00001",number:1n,identifier:"DPS"}},{issuer:{taxId:"12345678000195",name:"Prestador"},serviceLocation:{municipalityCode:"3304557"},dpsMunicipalTaxCode:"001",nbsCode:"113022100",fiscal:{regime:{simpleNational:"3",simpleAssessment:"1",special:"0"},iss:{taxation:"1",withholding:"1",rateSource:"PARAMETRIZED_BY_NATIONAL"},totalTaxes:{indicator:"0"}},emittedAt:"2026-09-02T00:00:00-03:00",applicationVersion:"test"});
    const xml=buildDpsXml(model);
    expect(xml).toContain("<cNBS>113022100</cNBS>");
    expect(xml).not.toContain("<pAliq>");
  });
  it("mantém a IM no cadastro pronta mesmo quando a DPS Nacional a omite",()=>{
    const readiness=getOrganizationReadiness({registration:{municipalRegistration:"0.191.068-0",street:"Av. Rio Branco",addressNumber:"99",neighborhood:"Centro",state:"RJ"},fiscal:{ready:true,message:""},services:{ready:true,message:""},certificate:{ready:true,message:""},clientAccess:{ready:true,message:""}});
    expect(readiness.items.find(item=>item.key==="registration")?.ready).toBe(true);
    expect(readiness.overallReady).toBe(true);
  });
  it("serializa IM do prestador somente quando a regra é SEND",async()=>{
    const sent=buildDpsXml(modelWithIssuerMunicipalRegistration(true));
    const omitted=buildDpsXml(modelWithIssuerMunicipalRegistration(false));
    expect(sent).toMatch(/<prest>[\s\S]*<IM>0\.191\.068-0<\/IM>/);
    expect(omitted).not.toMatch(/<prest>[\s\S]*<IM>/);
    expect(modelWithIssuerMunicipalRegistration(false).issuer.municipalRegistration).toBe("0.191.068-0");
    await expect(validateDpsXml(sent)).resolves.toMatchObject({valid:true});
    await expect(validateDpsXml(omitted)).resolves.toMatchObject({valid:true});
  });
  it("regrede E0120 omitindo a IM do prestador sem qualquer chamada SEFIN",()=>{
    const xml=buildDpsXml(modelWithIssuerMunicipalRegistration(false));
    expect(xml).not.toContain("<prest><CNPJ>40241895000170</CNPJ><IM>");
    expect(xml).toContain("<prest><CNPJ>40241895000170</CNPJ><xNome>");
  });
  it("bloqueia prontidão DPS sem o código municipal de três dígitos",async()=>await expect(assertDpsReadiness({organization:{legalName:"Prestador",taxId:"12345678000195",municipalRegistration:"123",municipalityCode:"3304557",address:{street:"Rua",number:"1",neighborhood:"Centro",postalCode:"20000000",municipalityCode:"3304557",stateOrProvince:"RJ"}},service:{nationalTaxCode:"070201",municipalTaxCode:"07.02.01.001",locationMunicipalityCode:"3304557"},customer:{name:"Tomador",taxId:"52998224725"},fiscal:{regime:{simpleNational:"1",special:"0"},iss:{taxation:"1",withholding:"1",rateSource:"EMITTER_PROVIDED",rateBasisPoints:500},totalTaxes:{indicator:"0"}},verifyCertificate:false})).rejects.toMatchObject({code:"FISCAL_CONFIGURATION_INCOMPLETE"}));
});
