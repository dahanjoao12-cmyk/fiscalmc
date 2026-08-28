import { gzipSync } from "node:zlib";
import { afterEach,describe,expect,it,vi } from "vitest";
import { MtlsHttpClient,MtlsRequestError } from "@/lib/nfse/client/mtls-http-client";
import { SafeFiscalError } from "@/lib/nfse/errors";
import { assertRestrictedEmissionReady } from "@/lib/nfse/issuance/restricted-readiness";
import { decideIdempotencyReplay,finalizationFromError } from "@/lib/nfse/issuance/state-machine";
import { submitInvoiceSafely,type InvoiceSubmissionGateway } from "@/lib/nfse/issuance/submission-service";
import { reconcileUnknownInvoice,type ReconciliationGateway } from "@/lib/nfse/reconciliation/service";
import { SefinRestrictedReconciliationClient } from "@/lib/nfse/reconciliation/client";
import type { InvoiceStatus,IssueResult } from "@/lib/nfse/types";

function submissionGateway(initial:InvoiceStatus="READY"){
  let status=initial;let claimed=false;const finalizations:unknown[]=[];
  const gateway:InvoiceSubmissionGateway={
    async claim(){if(status!=="READY"||claimed)return{claimed:false,currentStatus:status};claimed=true;status="SUBMITTING";return{claimed:true,currentStatus:status};},
    async finalize(input){finalizations.push(input.finalization);status=input.finalization.outcome;return status;},
  };
  return{gateway,finalizations,status:()=>status};
}

const base={invoiceId:"11111111-1111-4111-8111-111111111111",organizationId:"22222222-2222-4222-8222-222222222222",requestId:"33333333-3333-4333-8333-333333333333",dpsIdentifier:"DPS330455714024189500017000001000000000000001"};

describe("UNKNOWN e submissão idempotente",()=>{
  it.each(["ISSUED","REJECTED"] as const)("trata replay %s como resultado final",status=>expect(decideIdempotencyReplay(status)).toBe("RETURN_FINAL"));
  it("reconcilia replay UNKNOWN sem retransmitir",async()=>{const state=submissionGateway("UNKNOWN");const execute=vi.fn();const result=await submitInvoiceSafely({...base,gateway:state.gateway,execute});expect(result).toMatchObject({kind:"REPLAY",status:"UNKNOWN",decision:"RECONCILE"});expect(execute).not.toHaveBeenCalled();});
  it("bloqueia segunda transmissão enquanto SUBMITTING",async()=>{const state=submissionGateway("SUBMITTING");const execute=vi.fn();const result=await submitInvoiceSafely({...base,gateway:state.gateway,execute});expect(result).toMatchObject({kind:"REPLAY",decision:"IN_PROGRESS"});expect(execute).not.toHaveBeenCalled();});
  it("persiste READY → SUBMITTING → ISSUED",async()=>{const state=submissionGateway();const issued:IssueResult={status:"ISSUED",accessKey:"1".repeat(50),nfseNumber:"7",officialXml:"<NFSe/>"};expect(await submitInvoiceSafely({...base,gateway:state.gateway,execute:async()=>issued})).toEqual({kind:"RESULT",result:issued});expect(state.status()).toBe("ISSUED");});
  it("persiste rejeição confirmada",async()=>{const state=submissionGateway();await submitInvoiceSafely({...base,gateway:state.gateway,execute:async()=>({status:"REJECTED",code:"E1",safeMessage:"Rejeitada",technicalMessage:"regra"})});expect(state.status()).toBe("REJECTED");});
  it("transforma socket reset após envio em UNKNOWN",async()=>{const state=submissionGateway();const result=await submitInvoiceSafely({...base,gateway:state.gateway,execute:async()=>{throw new MtlsRequestError("reset","POSSIBLY_SENT","ECONNRESET");}});expect(result).toMatchObject({kind:"RESULT",result:{status:"UNKNOWN"}});expect(state.status()).toBe("UNKNOWN");expect(state.finalizations[0]).toMatchObject({attemptStatus:"UNKNOWN_AFTER_TRANSMISSION",bytesMayHaveBeenSent:true});});
  it("permite READY quando nada foi enviado",async()=>{expect(finalizationFromError(new MtlsRequestError("tls","NOT_SENT","ECONNREFUSED"))).toMatchObject({outcome:"READY",bytesMayHaveBeenSent:false,confirmedNoEmission:false});});
  it("registra resposta que confirma ausência de emissão sem fingir que bytes não saíram",()=>{expect(finalizationFromError(new SafeFiscalError("SEFIN_CONFIRMED_NO_EMISSION","Recusado"))).toMatchObject({outcome:"READY",bytesMayHaveBeenSent:true,confirmedNoEmission:true});});
  it("bloqueia transmissão concorrente no claim",async()=>{const state=submissionGateway();let release!:()=>void;const first=submitInvoiceSafely({...base,gateway:state.gateway,execute:()=>new Promise<IssueResult>(resolve=>{release=()=>resolve({status:"UNKNOWN",dpsIdentifier:base.dpsIdentifier,safeMessage:"wait"});})});await vi.waitFor(()=>expect(release).toBeTypeOf("function"));const secondExecute=vi.fn();const second=await submitInvoiceSafely({...base,requestId:"44444444-4444-4444-8444-444444444444",gateway:state.gateway,execute:secondExecute});expect(second).toMatchObject({kind:"REPLAY",decision:"IN_PROGRESS"});expect(secondExecute).not.toHaveBeenCalled();release();await first;});
});

function reconciliationGateway(status:InvoiceStatus="UNKNOWN"){
  let current=status;const gateway:ReconciliationGateway={async getInvoice(){return{status:current,dpsIdentifier:base.dpsIdentifier};},async record(input){current=input.result.status;return current;}};return{gateway,status:()=>current};
}

describe("reconcileUnknownInvoice",()=>{
  it("UNKNOWN → ISSUED",async()=>{const state=reconciliationGateway();const result=await reconcileUnknownInvoice({...base,gateway:state.gateway,lookup:{findByDps:async()=>({status:"ISSUED",accessKey:"1".repeat(50),nfseNumber:"9"})}});expect(result.status).toBe("ISSUED");});
  it("UNKNOWN → REJECTED quando a rejeição é oficial e identificável",async()=>{const state=reconciliationGateway();const result=await reconcileUnknownInvoice({...base,gateway:state.gateway,lookup:{findByDps:async()=>({status:"REJECTED",code:"R1",safeMessage:"Rejeitada"})}});expect(result.status).toBe("REJECTED");});
  it("mantém UNKNOWN sem reenviar",async()=>{const state=reconciliationGateway();const result=await reconcileUnknownInvoice({...base,gateway:state.gateway,lookup:{findByDps:async()=>({status:"UNKNOWN"})}});expect(result.status).toBe("UNKNOWN");});
  it("não consulta uma nota já finalizada",async()=>{const state=reconciliationGateway("ISSUED");const lookup=vi.fn();const result=await reconcileUnknownInvoice({...base,gateway:state.gateway,lookup:{findByDps:lookup}});expect(result).toEqual({status:"ISSUED",reconciled:false});expect(lookup).not.toHaveBeenCalled();});
});

describe("consulta oficial somente leitura",()=>{
  it("consulta DPS e NFS-e com organizationId e valida a resposta",async()=>{
    const key="1".repeat(50);const xml="<NFSe><infNFSe><nNFSe>42</nNFSe></infNFSe></NFSe>";
    const requestText=vi.fn().mockResolvedValueOnce({url:"dps",status:200,body:JSON.stringify({chaveAcesso:key})}).mockResolvedValueOnce({url:"nfse",status:200,body:JSON.stringify({chaveAcesso:key,nfseXmlGZipB64:gzipSync(Buffer.from(xml)).toString("base64")})});
    const client=new SefinRestrictedReconciliationClient({requestText} as unknown as MtlsHttpClient);
    await expect(client.findByDps({organizationId:base.organizationId,dpsIdentifier:base.dpsIdentifier})).resolves.toMatchObject({status:"ISSUED",accessKey:key,nfseNumber:"42"});
    expect(requestText).toHaveBeenCalledTimes(2);expect(requestText).toHaveBeenNthCalledWith(1,expect.objectContaining({organizationId:base.organizationId}));
  });
});

describe("gate de Produção Restrita",()=>{
  const ready={registrationReady:true,fiscalReady:true,serviceReady:true,certificateReady:true,clientAccessReady:true,organizationStatus:"ACTIVE",emissionBlocked:false,environment:"production_restricted",provider:"national",productionEnabled:"false",restrictedTransmissionEnabled:"true"};
  afterEach(()=>vi.unstubAllEnvs());
  it("libera somente restrita explicitamente autorizada",()=>expect(assertRestrictedEmissionReady(ready)).toEqual({environment:"PRODUCTION_RESTRICTED",productionBlocked:true}));
  it("mantém Produção bloqueada",()=>expect(()=>assertRestrictedEmissionReady({...ready,environment:"production",productionEnabled:"true"})).toThrowError(SafeFiscalError));
  it("não libera organization emission_blocked",()=>expect(()=>assertRestrictedEmissionReady({...ready,emissionBlocked:true})).toThrowError(SafeFiscalError));
  it("não libera sem certificado ou acesso",()=>expect(()=>assertRestrictedEmissionReady({...ready,certificateReady:false,clientAccessReady:false})).toThrowError(SafeFiscalError));
});
