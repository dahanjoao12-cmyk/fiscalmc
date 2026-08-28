import type { InvoiceStatus } from "@/lib/nfse/types";

export type InvoiceActionKind = "NO_ACTION_REQUIRED" | "WAITING_CONFIRMATION" | "USER_ACTION_REQUIRED" | "OFFICE_ACTION_REQUIRED";
export type InvoiceTone = "success" | "warning" | "danger" | "info" | "neutral";

type Presentation = {
  label: string;
  title: string;
  description: string;
  tone: InvoiceTone;
  action: InvoiceActionKind;
};

const publicStatus: Record<InvoiceStatus, Presentation> = {
  ISSUED: { label: "Emitida", title: "NFS-e emitida com sucesso", description: "A nota está disponível para consulta.", tone: "success", action: "NO_ACTION_REQUIRED" },
  UNKNOWN: { label: "Em confirmação", title: "Estamos confirmando a situação desta NFS-e", description: "A solicitação foi enviada, mas ainda estamos confirmando o retorno oficial. Não emita novamente.", tone: "warning", action: "WAITING_CONFIRMATION" },
  SUBMITTING: { label: "Em confirmação", title: "Estamos confirmando a situação desta NFS-e", description: "A solicitação está sendo processada. Não emita novamente.", tone: "warning", action: "WAITING_CONFIRMATION" },
  REJECTED: { label: "Não emitida", title: "Não foi possível emitir esta NFS-e", description: "Esta solicitação não gerou uma NFS-e autorizada.", tone: "danger", action: "OFFICE_ACTION_REQUIRED" },
  CANCELLED: { label: "Cancelada", title: "Esta NFS-e foi cancelada", description: "A nota não está mais válida para a operação original.", tone: "danger", action: "NO_ACTION_REQUIRED" },
  READY: { label: "Em preparação", title: "Solicitação em preparação", description: "A emissão ainda não foi concluída.", tone: "info", action: "NO_ACTION_REQUIRED" },
  DRAFT: { label: "Em preparação", title: "Solicitação em preparação", description: "A emissão ainda não foi concluída.", tone: "neutral", action: "NO_ACTION_REQUIRED" },
};

function normalizedStatus(status: string): InvoiceStatus {
  return status === "SUBMITTING" || status === "ISSUED" || status === "REJECTED" || status === "UNKNOWN" || status === "CANCELLED" || status === "READY" || status === "DRAFT" ? status : "READY";
}

/** Maps persisted fiscal states to safe, consistent language for every surface. */
export function getInvoicePresentation(status: string, safeStatusMessage?: string | null): Presentation {
  const base = publicStatus[normalizedStatus(status)];
  if (status !== "REJECTED" || !safeStatusMessage?.trim()) return base;
  const message = safeStatusMessage.trim();
  const userCanResolve = /(cpf|cnpj|tomador|endereço|endereco|cep)/i.test(message);
  return { ...base, description: message, action: userCanResolve ? "USER_ACTION_REQUIRED" : "OFFICE_ACTION_REQUIRED" };
}

export type InvoiceTimelineAttempt = { id: string; status: string; startedAt: string; finishedAt?: string | null; safeMessage?: string | null };
export type InvoiceTimelineEvent = { id: string; title: string; description?: string; at: string; tone: InvoiceTone };

const attemptPresentation: Record<string, { title: string; tone: InvoiceTone }> = {
  STARTED: { title: "Envio iniciado", tone: "info" },
  SUBMITTING: { title: "Envio iniciado", tone: "info" },
  COMPLETED: { title: "Retorno recebido", tone: "success" },
  ISSUED: { title: "NFS-e emitida", tone: "success" },
  REJECTED: { title: "Emissão não concluída", tone: "danger" },
  UNKNOWN: { title: "Situação em confirmação", tone: "warning" },
  UNKNOWN_AFTER_TRANSMISSION: { title: "Situação em confirmação", tone: "warning" },
  BUILD_FAILED: { title: "Preparação não concluída", tone: "danger" },
  SIGNATURE_FAILED: { title: "Preparação não concluída", tone: "danger" },
  TRANSMISSION_FAILED: { title: "Envio não concluído", tone: "danger" },
};

export function buildInvoiceTimeline(input: { createdAt: string; status: string; issuedAt?: string | null; updatedAt?: string | null; lastReconciledAt?: string | null; attempts: InvoiceTimelineAttempt[]; office?: boolean }): InvoiceTimelineEvent[] {
  const events: InvoiceTimelineEvent[] = [{ id: "created", title: "Solicitação criada", at: input.createdAt, tone: "info" }];
  for (const attempt of [...input.attempts].reverse()) {
    const item = attemptPresentation[attempt.status] ?? { title: "Atualização da solicitação", tone: "info" as const };
    events.push({ id: `attempt-${attempt.id}`, title: item.title, description: attempt.safeMessage ?? undefined, at: attempt.finishedAt ?? attempt.startedAt, tone: item.tone });
  }
  if (input.lastReconciledAt) events.push({ id: "reconciled", title: input.status === "UNKNOWN" ? "Situação consultada" : "Situação confirmada", at: input.lastReconciledAt, tone: input.status === "UNKNOWN" ? "warning" : "success" });
  if (input.status === "ISSUED" && !events.some((event) => event.title === "NFS-e emitida")) events.push({ id: "issued", title: "NFS-e emitida", at: input.issuedAt ?? input.updatedAt ?? input.createdAt, tone: "success" });
  if (input.status === "REJECTED" && !events.some((event) => event.title === "Emissão não concluída")) events.push({ id: "rejected", title: "Emissão não concluída", at: input.updatedAt ?? input.createdAt, tone: "danger" });
  if ((input.status === "UNKNOWN" || input.status === "SUBMITTING") && !events.some((event) => event.title === "Situação em confirmação")) events.push({ id: "unknown", title: "Situação em confirmação", at: input.updatedAt ?? input.createdAt, tone: "warning" });
  return events.toSorted((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function isFinishedInvoiceStatus(status: string) {
  return status === "ISSUED" || status === "REJECTED" || status === "CANCELLED";
}
