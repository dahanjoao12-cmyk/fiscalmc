import forge from "node-forge";
import { readFile } from "node:fs/promises";
import { describe,expect,it } from "vitest";
import { loadA1Material,validateA1 } from "@/lib/nfse/certificate/parse";
import { CERTIFICATE_EXPIRING_SOON_DAYS,classifyCertificate,getCertificateReadiness } from "@/lib/nfse/certificate/status";
import { certificateHolderName } from "@/lib/nfse/certificate/presentation";
import { buildFiscalDocument } from "@/lib/nfse/issuance/domain";
import { mapToDpsModel } from "@/lib/nfse/dps/model";
import { buildDpsXml } from "@/lib/nfse/dps/xml";
import { validateDpsXml } from "@/lib/nfse/dps/xsd";
import { signDpsXml,verifyDpsSignature } from "@/lib/nfse/dps/signature";
import { buildSefinDpsRequest } from "@/lib/nfse/dps/sefin-request";

function testP12(input:{taxId:string;password:string;validFrom:Date;validUntil:Date}){
  const keys=forge.pki.rsa.generateKeyPair(1024);
  const certificate=forge.pki.createCertificate();
  certificate.publicKey=keys.publicKey;certificate.serialNumber="01";certificate.validity.notBefore=input.validFrom;certificate.validity.notAfter=input.validUntil;
  certificate.setSubject([{name:"commonName",value:"Certificado de teste"},{name:"serialNumber",value:input.taxId}]);
  certificate.setIssuer([{name:"commonName",value:"Emissor de teste"}]);
  certificate.sign(keys.privateKey,forge.md.sha256.create());
  const p12=forge.pkcs12.toPkcs12Asn1(keys.privateKey,certificate,input.password,{algorithm:"3des"});
  return Buffer.from(forge.asn1.toDer(p12).getBytes(),"binary");
}
const now=new Date("2026-08-27T12:00:00.000Z");
const validInput={taxId:"40241895000170",password:"senha-de-teste",validFrom:new Date("2026-01-01T00:00:00.000Z"),validUntil:new Date("2027-01-01T00:00:00.000Z")};

describe("A1 certificate validation",()=>{
  it("lê PKCS#12 válido e extrai CNPJ/fingerprint",()=>{
    const result=validateA1(testP12(validInput),validInput.password,now);
    expect(result.status).toBe("VALID");
    expect(result.metadata?.ownerTaxId).toBe(validInput.taxId);
    expect(result.metadata?.fingerprintSha256).toMatch(/^[A-F0-9]{64}$/);
  });
  it("lê o CNPJ explícito no CN ICP-Brasil sem inferir pelo nome",()=>{
    const keys=forge.pki.rsa.generateKeyPair(1024);const certificate=forge.pki.createCertificate();certificate.publicKey=keys.publicKey;certificate.serialNumber="02";certificate.validity.notBefore=validInput.validFrom;certificate.validity.notAfter=validInput.validUntil;certificate.setSubject([{name:"commonName",value:`Empresa de teste:${validInput.taxId}`}]);certificate.setIssuer([{name:"commonName",value:"Emissor de teste"}]);certificate.sign(keys.privateKey,forge.md.sha256.create());const p12=Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,certificate,validInput.password)).getBytes(),"binary");
    expect(validateA1(p12,validInput.password,now).metadata?.ownerTaxId).toBe(validInput.taxId);
  });
  it("rejeita senha incorreta e conteúdo que não é PKCS#12",()=>{
    const p12=testP12(validInput);
    expect(validateA1(p12,"outra-senha",now).status).toBe("INVALID_PASSWORD");
    expect(validateA1(Buffer.from("não é p12"),validInput.password,now).status).toBe("INVALID_FILE");
  });
  it("não fornece chave quando o certificado está expirado",()=>{
    const p12=testP12({...validInput,validUntil:new Date("2026-08-01T00:00:00.000Z")});
    expect(validateA1(p12,validInput.password,now).status).toBe("EXPIRED");
    expect(()=>loadA1Material(p12,validInput.password,now)).toThrow();
  });
  it("classifica expiração próxima sem transformar em inválido",()=>{
    const p12=testP12({...validInput,validUntil:new Date("2026-09-10T00:00:00.000Z")});
    const result=validateA1(p12,validInput.password,now);
    expect(result.metadata&&classifyCertificate(result.metadata,now)).toBe("EXPIRING");
    expect(CERTIFICATE_EXPIRING_SOON_DAYS).toBe(30);
  });
  it("falha fechado quando CNPJ do registro não corresponde à organização",()=>{
    const readiness=getCertificateReadiness({certificate:{status:"VALID",owner_tax_id:"11111111000111",valid_until:"2027-01-01T00:00:00.000Z"},organizationTaxId:validInput.taxId,now});
    expect(readiness.ready).toBe(false);expect(readiness.status).toBe("MISMATCH");
  });
  it("aceita current válido e alerta para vencimento próximo",()=>{
    const valid=getCertificateReadiness({certificate:{status:"VALID",owner_tax_id:validInput.taxId,valid_until:"2027-01-01T00:00:00.000Z"},organizationTaxId:validInput.taxId,now});
    const expiring=getCertificateReadiness({certificate:{status:"EXPIRING",owner_tax_id:validInput.taxId,valid_until:"2026-09-10T00:00:00.000Z"},organizationTaxId:validInput.taxId,now});
    expect(valid.ready).toBe(true);expect(expiring.ready).toBe(true);expect(expiring.warning).toBe(true);
  });
  it("apresenta o CN sem expor o subject X.509 inteiro",()=>{
    expect(certificateHolderName(`C=BR, CN=Empresa Exemplo:${validInput.taxId}, O=ICP-Brasil`)).toBe("Empresa Exemplo");
  });
  it("assina pela abstração de provider, sem depender do caminho local",async()=>{
    const material=loadA1Material(testP12(validInput),validInput.password,now);
    const fixture=await readFile(new URL("../../fixtures/dps/minimal-valid-unsigned.xml",import.meta.url),"utf8");
    const signed=await signDpsXml(fixture,{organizationId:"organization-a",certificateProvider:{getCertificateMaterial:async input=>{expect(input.organizationId).toBe("organization-a");return material;}}});
    expect(verifyDpsSignature(signed)).toBe(true);
  });
  it("simula a DPS 00001/4 em memória com identificador CNPJ, XSD, assinatura e payload",async()=>{
    const document=buildFiscalDocument({
      organization:{id:"moreira",taxId:"40241895000170",municipalRegistration:"12345",municipalityCode:"3304557"},
      customer:{taxId:"68644533000140",legalName:"ORLA RIO CONCESSIONARIA LTDA."},
      service:{nationalTaxCode:"171901",municipalServiceCode:"001"},
      taxConfiguration:{regime:"SIMPLES_NACIONAL",taxationType:"MUNICIPAL",iss:{withheld:false,source:"ACCEPTED_PRODUCTION_DPS"},ibsCbs:{customerFieldsEnabled:false}},
      amountCents:10000,serviceDate:"2026-09-02",description:"Serviços contábeis - emissão de homologação",dpsSeries:"00001",dpsNumber:4n,
    });
    expect(document.dps.identifier).toBe(["DPS","3304557","2","40241895000170","00001","000000000000004"].join(""));
    const model=mapToDpsModel(document,{issuer:{taxId:"40241895000170",municipalRegistration:"12345",name:"ASSESSORIA CONTABIL MOREIRA & CASTRO",address:{street:"Av. Rio Branco",number:"99",neighborhood:"Centro",postalCode:"20040004",municipalityCode:"3304557",stateOrProvince:"RJ",countryCode:"BR"}},customer:{taxId:"68644533000140",name:"ORLA RIO CONCESSIONARIA LTDA.",address:{street:"Do Joá",number:"3336",neighborhood:"Barra da Tijuca",postalCode:"22610141",municipalityCode:"3304557",stateOrProvince:"RJ",countryCode:"BR"}},serviceLocation:{municipalityCode:"3304557"},dpsMunicipalTaxCode:"001",nbsCode:"113022100",fiscal:{regime:{simpleNational:"3",simpleAssessment:"1",special:"0"},iss:{taxation:"1",withholding:"1",rateSource:"PARAMETRIZED_BY_NATIONAL"},totalTaxes:{indicator:"0"}},emittedAt:"2026-09-02T12:00:00-03:00",applicationVersion:"test"});
    const unsigned=buildDpsXml(model);
    expect((await validateDpsXml(unsigned)).valid).toBe(true);
    const material=loadA1Material(testP12(validInput),validInput.password,now);
    const signed=await signDpsXml(unsigned,{organizationId:"moreira",certificateProvider:{getCertificateMaterial:async()=>material}});
    expect(verifyDpsSignature(signed)).toBe(true);
    expect((await validateDpsXml(signed)).valid).toBe(true);
    expect(buildSefinDpsRequest(signed).dpsXmlGZipB64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
