import { describe, expect, it, vi } from "vitest";
import { isAuthorizedInternalRequest, sweepUnknownInvoices } from "@/lib/nfse/reconciliation/sweep";
import type { InvoiceStatus } from "@/lib/nfse/types";

describe("isAuthorizedInternalRequest", () => {
  it("rejeita quando o segredo esperado não está configurado", () => {
    expect(isAuthorizedInternalRequest("qualquer-coisa", undefined)).toBe(false);
    expect(isAuthorizedInternalRequest("qualquer-coisa", "")).toBe(false);
  });
  it("rejeita quando nenhum segredo foi enviado", () => {
    expect(isAuthorizedInternalRequest(null, "segredo-real")).toBe(false);
  });
  it("rejeita um segredo de tamanho ou conteúdo diferente", () => {
    expect(isAuthorizedInternalRequest("errado", "segredo-real")).toBe(false);
    expect(isAuthorizedInternalRequest("segredo-rea", "segredo-real")).toBe(false);
  });
  it("aceita quando o segredo enviado bate exatamente", () => {
    expect(isAuthorizedInternalRequest("segredo-real", "segredo-real")).toBe(true);
  });
});

function fakeDb(rows: Array<{ id: string; organization_id: string }>) {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit: () => Promise.resolve({ data: rows, error: null }),
      };
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("sweepUnknownInvoices", () => {
  it("varre cada nota pendente e soma os resultados sem parar em uma falha", async () => {
    const rows = [
      { id: "inv-1", organization_id: "org-1" },
      { id: "inv-2", organization_id: "org-1" },
      { id: "inv-3", organization_id: "org-2" },
    ];
    const reconcile = vi.fn(async ({ invoiceId }: { invoiceId: string; organizationId: string }) => {
      if (invoiceId === "inv-1") return { status: "ISSUED" as InvoiceStatus, reconciled: true as const };
      if (invoiceId === "inv-2") return { status: "UNKNOWN" as InvoiceStatus, reconciled: true as const };
      throw new Error("CERTIFICATE_EXPIRED");
    });
    const result = await sweepUnknownInvoices({ db: fakeDb(rows), reconcile });
    expect(result).toEqual({ checked: 3, resolved: 1, stillUnknown: 1, failed: 1 });
    expect(reconcile).toHaveBeenCalledTimes(3);
  });

  it("não faz nada quando não há notas pendentes", async () => {
    const reconcile = vi.fn();
    const result = await sweepUnknownInvoices({ db: fakeDb([]), reconcile });
    expect(result).toEqual({ checked: 0, resolved: 0, stillUnknown: 0, failed: 0 });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("propaga uma falha na consulta ao banco", async () => {
    const failingDb = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit: () => Promise.resolve({ data: null, error: { message: "db down" } }),
        };
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    await expect(sweepUnknownInvoices({ db: failingDb })).rejects.toThrow("PENDING_INVOICES_LOOKUP_FAILED");
  });
});
