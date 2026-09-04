import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { officialArtifactStoragePath } from "@/lib/nfse/artifacts/persistence";
import { recoverIssuedInvoiceArtifacts } from "@/lib/nfse/artifacts/recovery";
import { MtlsHttpClient } from "@/lib/nfse/client/mtls-http-client";
import { SefinRestrictedReconciliationClient } from "@/lib/nfse/reconciliation/client";

const organizationId="22222222-2222-4222-8222-222222222222";
const invoiceId="11111111-1111-4111-8111-111111111111";
const accessKey="1".repeat(50);
const xml="<NFSe><infNFSe><nNFSe>42</nNFSe></infNFSe></NFSe>";

describe("recuperação oficial pós-emissão",()=>{
  it("recupera XML por GET oficial sem transmitir",async()=>{
    const requestText=vi.fn().mockResolvedValue({url:"nfse",status:200,contentType:"application/json",body:JSON.stringify({chaveAcesso:accessKey,nfseXmlGZipB64:gzipSync(Buffer.from(xml)).toString("base64"),dataHoraProcessamento:"2026-09-04T14:29:00-03:00"})});
    const client=new SefinRestrictedReconciliationClient({requestText} as unknown as MtlsHttpClient);
    await expect(client.getNfseByAccessKey({organizationId,accessKey})).resolves.toMatchObject({accessKey,nfseNumber:"42",xml});
    expect(requestText).toHaveBeenCalledWith(expect.objectContaining({organizationId,url:expect.stringMatching(/\/nfse\//)}));
    expect(requestText.mock.calls[0][0].method).toBeUndefined();
  });

  it("aceita DANFSe somente como PDF oficial e trata 404 como indisponível",async()=>{
    const requestBuffer=vi.fn().mockResolvedValueOnce({url:"danfse",status:404,contentType:"application/json",body:Buffer.from("{}")}).mockResolvedValueOnce({url:"danfse",status:200,contentType:"application/pdf",body:Buffer.from("%PDF-1.7\n")});
    const client=new SefinRestrictedReconciliationClient({requestBuffer} as unknown as MtlsHttpClient);
    await expect(client.getDanfseByAccessKey({organizationId,accessKey})).resolves.toBeNull();
    await expect(client.getDanfseByAccessKey({organizationId,accessKey})).resolves.toMatchObject({contentType:"application/pdf"});
    expect(requestBuffer).toHaveBeenCalledTimes(2);
    expect(requestBuffer.mock.calls[0][0]).toMatchObject({organizationId,headers:{accept:"application/pdf"}});
  });

  it("persiste apenas artifacts privados recuperados por GET",async()=>{
    const getNfseByAccessKey=vi.fn().mockResolvedValue({accessKey,nfseNumber:"42",xml,issuedAt:"2026-09-04T14:29:00-03:00"});
    const getDanfseByAccessKey=vi.fn().mockResolvedValue({pdf:Buffer.from("%PDF-1.7\n"),contentType:"application/pdf"});
    const persist=vi.fn(async(input:{artifactType:"NFSE_XML"|"DANFSE_PDF"})=>({id:"artifact",artifact_type:input.artifactType,private_storage_path:"org/invoice/file",content_type:"application/xml",checksum_sha256:"hash"}));
    const result=await recoverIssuedInvoiceArtifacts({invoiceId,organizationId,accessKey,client:{getNfseByAccessKey,getDanfseByAccessKey} as unknown as SefinRestrictedReconciliationClient,persist});
    expect(result).toMatchObject({nfseNumber:"42",recoveredTypes:["NFSE_XML","DANFSE_PDF"],danfseAvailable:true});
    expect(persist).toHaveBeenCalledTimes(2);
    expect(getNfseByAccessKey).toHaveBeenCalledTimes(1);
    expect(getDanfseByAccessKey).toHaveBeenCalledTimes(1);
  });

  it("usa um path privado que não depende de dado vindo do navegador",()=>{
    expect(officialArtifactStoragePath({organizationId,invoiceId,artifactType:"NFSE_XML"})).toBe(`${organizationId}/${invoiceId}/nfse.xml`);
  });
});
