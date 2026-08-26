import { describe,expect,it } from "vitest";
import { getServiceReadiness } from "@/lib/nfse/service-readiness";

const complete={active:true,national_service_code_id:"national",municipal_service_code:"07.02.01.001",municipal_service_mapping_id:"mapping",dps_municipal_tax_code:"123",dps_municipal_tax_code_source:"Anexo técnico confirmado",service_location_municipality_code:"3304557",reviewed_at:null};

describe("service template readiness",()=>{
  it("mantém código DPS desconhecido como pendência",()=>{
    const readiness=getServiceReadiness({...complete,dps_municipal_tax_code:null});
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("Código DPS municipal");
  });
  it("não aceita código municipal sem de/para selecionado",()=>{
    const readiness=getServiceReadiness({...complete,municipal_service_mapping_id:null});
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("De/para municipal");
  });
  it("exige a fonte do código DPS antes da revisão",()=>{
    const readiness=getServiceReadiness({...complete,dps_municipal_tax_code_source:null});
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("Fonte do código DPS municipal");
  });
  it("só torna um serviço pronto quando ativo e revisado",()=>{
    expect(getServiceReadiness({...complete,reviewed_at:"2026-08-26T12:00:00.000Z"}).ready).toBe(true);
    expect(getServiceReadiness({...complete,active:false,reviewed_at:"2026-08-26T12:00:00.000Z"}).ready).toBe(false);
  });
});
