import { describe,expect,it } from "vitest"; import { parseMoneyToCents } from "@/lib/validation/money";
describe("valores monetários",()=>{it("converte decimal em centavos",()=>expect(parseMoneyToCents("1500.00")).toBe(150000));it("arredonda com segurança",()=>expect(parseMoneyToCents(10.129)).toBe(1013));it("rejeita valor zero",()=>expect(()=>parseMoneyToCents(0)).toThrow());});
