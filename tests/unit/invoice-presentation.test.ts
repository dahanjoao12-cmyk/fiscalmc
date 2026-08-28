import { describe, expect, it } from "vitest";
import { buildInvoiceTimeline, getInvoicePresentation } from "@/lib/invoices/presentation";

describe("apresentação pública de notas", () => {
  it("usa uma linguagem consistente para a NFS-e emitida", () => {
    expect(getInvoicePresentation("ISSUED")).toMatchObject({ label: "Emitida", title: "NFS-e emitida com sucesso", action: "NO_ACTION_REQUIRED" });
  });

  it("mantém UNKNOWN em confirmação e nunca sugere retransmissão", () => {
    const presentation = getInvoicePresentation("UNKNOWN");
    expect(presentation).toMatchObject({ label: "Em confirmação", action: "WAITING_CONFIRMATION" });
    expect(presentation.description).toContain("Não emita novamente");
  });

  it("usa a mensagem segura da rejeição e classifica correção do tomador", () => {
    expect(getInvoicePresentation("REJECTED", "Revise o CPF/CNPJ informado para o tomador.")).toMatchObject({
      label: "Não emitida",
      description: "Revise o CPF/CNPJ informado para o tomador.",
      action: "USER_ACTION_REQUIRED",
    });
  });

  it("direciona problemas fiscais desconhecidos ao escritório", () => {
    expect(getInvoicePresentation("REJECTED", "A configuração fiscal precisa ser revisada.").action).toBe("OFFICE_ACTION_REQUIRED");
  });

  it("constrói timeline segura sem expor estados técnicos como texto principal", () => {
    const timeline = buildInvoiceTimeline({
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T10:02:00.000Z",
      status: "UNKNOWN",
      attempts: [{ id: "a", status: "UNKNOWN_AFTER_TRANSMISSION", startedAt: "2026-08-28T10:01:00.000Z" }],
    });
    expect(timeline.map((event) => event.title)).toEqual(["Solicitação criada", "Situação em confirmação"]);
    expect(timeline.some((event) => event.title.includes("UNKNOWN"))).toBe(false);
  });
});
