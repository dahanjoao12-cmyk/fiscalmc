import { CERTIFICATE_EXPIRING_SOON_DAYS, type StoredCertificateStatus } from "@/lib/nfse/certificate/status";

export type OperationalPriority = "CRITICAL" | "HIGH" | "NORMAL";
export type OperationalItemType = "INVOICE_UNKNOWN" | "INVOICE_REJECTED" | "CERTIFICATE_EXPIRING" | "CERTIFICATE_EXPIRED" | "SERVICE_PENDING_REVIEW" | "SERVICE_NEEDS_INFO" | "ORGANIZATION_NOT_READY" | "CLIENT_ACCESS_INVALID" | "CANCELLATION_PENDING";
export type OperationalItem = { id: string; organizationId: string; organizationName: string; type: OperationalItemType; title: string; description: string; priority: OperationalPriority; createdAt: string; updatedAt: string; href: string };

export function getOperationalPriority(type: OperationalItemType, input?: { ageHours?: number }): OperationalPriority {
  if (type === "CERTIFICATE_EXPIRED") return "CRITICAL";
  if (type === "INVOICE_UNKNOWN" && (input?.ageHours ?? 0) >= 1) return "HIGH";
  if (type === "INVOICE_REJECTED" || type === "CERTIFICATE_EXPIRING" || type === "CANCELLATION_PENDING") return "HIGH";
  return "NORMAL";
}

export function certificateDaysRemaining(validUntil: string, now = new Date()) {
  return Math.floor((new Date(validUntil).getTime() - now.getTime()) / 86_400_000);
}

export function operationalAgeHours(createdAt: string, now = new Date()) {
  return Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / 3_600_000);
}

export function getCertificateOperationalState(input: { status: StoredCertificateStatus; validUntil: string; now?: Date }) {
  const daysRemaining = certificateDaysRemaining(input.validUntil, input.now);
  if (input.status === "EXPIRED" || daysRemaining < 0) return { type: "CERTIFICATE_EXPIRED" as const, daysRemaining };
  if (input.status === "EXPIRING" || daysRemaining <= CERTIFICATE_EXPIRING_SOON_DAYS) return { type: "CERTIFICATE_EXPIRING" as const, daysRemaining };
  return null;
}

export const certificateReminderThresholds = [30, 15, 7, 1] as const;
export function getCertificateReminderBucket(validUntil: string, now = new Date()) {
  const days = certificateDaysRemaining(validUntil, now);
  return certificateReminderThresholds.find((threshold) => days <= threshold && days >= 0) ?? null;
}

export function getCancellationStatusPresentation(status: string) {
  const labels: Record<string, { label: string; tone: "warning" | "success" | "danger" | "info" | "neutral" }> = {
    REQUESTED: { label: "Solicitado", tone: "info" },
    UNDER_REVIEW: { label: "Em análise", tone: "warning" },
    APPROVED: { label: "Aprovado internamente", tone: "info" },
    PROCESSING: { label: "Em processamento", tone: "warning" },
    UNKNOWN: { label: "Em confirmação", tone: "warning" },
    CANCELLED: { label: "Cancelada", tone: "success" },
    COMPLETED: { label: "Concluído", tone: "success" },
    REJECTED: { label: "Não aprovado", tone: "danger" },
    DENIED: { label: "Não aprovado", tone: "danger" },
  };
  return labels[status] ?? { label: "Revisão necessária", tone: "neutral" as const };
}

export function isCancellationOpen(status: string) {
  return ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "UNKNOWN"].includes(status);
}
