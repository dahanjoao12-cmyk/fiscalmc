import { describe, expect, it } from "vitest";
import { relationName, relationOne } from "@/lib/presentation/relations";
describe("relation presentation",()=>{
  it("normalizes singular objects and singular arrays",()=>{expect(relationName({legal_name:"Moreira & Castro"},"Empresa não disponível")).toBe("Moreira & Castro");expect(relationName([{legal_name:"Tomador real"}],"Tomador não disponível")).toBe("Tomador real");expect(relationName([{name:"Contabilidade"}],"Serviço não disponível")).toBe("Contabilidade");});
  it("keeps human fallbacks only for absent relationships",()=>{expect(relationOne(null)).toBeNull();expect(relationName(undefined,"Empresa não disponível")).toBe("Empresa não disponível");expect(relationName([],"Serviço não disponível")).toBe("Serviço não disponível");});
});
