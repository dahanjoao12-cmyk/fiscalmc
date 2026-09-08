import { describe, expect, it } from "vitest";
import { buildAuthorizedNfseAuxiliaryPdf } from "@/lib/nfse/artifacts/auxiliary-pdf";
import { hasDanfseArtifact } from "@/lib/nfse/artifacts/model";

describe("auxiliary invoice PDF", () => {
  const invoice={nfseNumber:"12",accessKey:"chave",serviceDate:"2026-09-08",amountCents:12345,description:"Serviço autorizado"};
  it("produz um PDF privado em memória com dados autorizados",async()=>{
    const pdf=await buildAuthorizedNfseAuxiliaryPdf({xml:Buffer.from("<NFSe><nNFSe>12</nNFSe><chaveAcesso>chave</chaveAcesso></NFSe>"),invoice});
    expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
    expect(pdf.toString("utf8")).not.toContain("CERTIFICATE_MASTER_KEY");
  });
  it("mantém a prioridade do DANFSe oficial",()=>{
    expect(hasDanfseArtifact([{artifact_type:"DANFSE_PDF"}])).toBe(true);
    expect(hasDanfseArtifact([{artifact_type:"NFSE_XML"}])).toBe(false);
  });
});
