import { describe, expect, it } from "vitest";
import { issuanceFailureDiagnostic, sanitizeDatabaseDiagnostic } from "@/lib/nfse/issuance/request-diagnostics";

describe("diagnóstico seguro da emissão", () => {
  it("preserva código e estrutura de uma falha de banco sem expor valores", () => {
    const diagnostic = sanitizeDatabaseDiagnostic({
      code: "23505",
      message: 'duplicate key value violates unique constraint "invoices_organization_id_idempotency_key_key"',
      details: 'Key (organization_id, idempotency_key)=(33fa0be6-1b0e-4808-bbc2-368dbf822213, 11111111-1111-4111-8111-111111111111) already exists.',
    });

    expect(diagnostic).toMatchObject({
      postgresCode: "23505",
      constraint: "invoices_organization_id_idempotency_key_key",
      message: expect.stringContaining("unique constraint"),
      details: expect.stringContaining("=[redacted]"),
    });
    expect(JSON.stringify(diagnostic)).not.toContain("33fa0be6");
  });

  it("atribui a falha de persistência ao estágio de insert", () => {
    expect(issuanceFailureDiagnostic("INVOICE_INSERT", new Error("INVOICE_PERSIST_FAILED"))).toMatchObject({
      stage: "INVOICE_INSERT",
      safeCode: "INVOICE_PERSIST_FAILED",
    });
  });
});
