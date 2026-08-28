import { z } from "zod";

export const serviceWorkflowStatuses = ["DRAFT", "PENDING_REVIEW", "NEEDS_INFO", "REVIEWED", "INACTIVE"] as const;
export type ServiceWorkflowStatus = (typeof serviceWorkflowStatuses)[number];
export type ServiceCreatedVia = "CLIENT" | "OFFICE";

export const clientServiceFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  defaultDescription: z.string().trim().min(3).max(1000),
  serviceLocationMode: z.enum(["ORGANIZATION", "OTHER"]),
  serviceLocation: z.string().trim().max(160).nullable().optional(),
  clientNote: z.string().trim().max(1000).nullable().optional(),
}).strict();

export type ClientServiceFields = z.infer<typeof clientServiceFieldsSchema>;

export const clientServiceMutationSchema = z.discriminatedUnion("action", [
  clientServiceFieldsSchema.extend({ action: z.literal("create") }),
  clientServiceFieldsSchema.extend({ action: z.literal("update"), id: z.uuid() }),
  z.object({ action: z.literal("submit"), id: z.uuid() }),
]);

export type ClientServiceRecord = {
  name: string;
  default_description: string | null;
  client_service_location: string | null;
  client_note: string | null;
  workflow_status: ServiceWorkflowStatus;
  active: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string | null;
};

function normalized(value: string | null | undefined) {
  return value?.trim() || null;
}

export function clientFieldsChanged(current: ClientServiceRecord, next: ClientServiceFields) {
  return current.name !== next.name.trim()
    || normalized(current.default_description) !== normalized(next.defaultDescription)
    || normalized(current.client_service_location) !== (next.serviceLocationMode === "OTHER" ? normalized(next.serviceLocation) : null)
    || normalized(current.client_note) !== normalized(next.clientNote);
}

export function buildClientServiceCreate(input: ClientServiceFields, actorUserId: string) {
  return {
    name: input.name.trim(),
    default_description: input.defaultDescription.trim(),
    client_service_location: input.serviceLocationMode === "OTHER" ? normalized(input.serviceLocation) : null,
    client_note: normalized(input.clientNote),
    workflow_status: "DRAFT" as const,
    created_by: actorUserId,
    created_via: "CLIENT" as const,
    active: false,
    reviewed_at: null,
    reviewed_by: null,
  };
}

export function buildClientServiceUpdate(current: ClientServiceRecord, input: ClientServiceFields, now: string) {
  const changed = clientFieldsChanged(current, input);
  const reviewReset = changed && current.workflow_status === "REVIEWED";
  const pending = changed && (current.workflow_status === "PENDING_REVIEW" || reviewReset);
  return {
    changed,
    reviewReset,
    values: {
      name: input.name.trim(),
      default_description: input.defaultDescription.trim(),
      client_service_location: input.serviceLocationMode === "OTHER" ? normalized(input.serviceLocation) : null,
      client_note: normalized(input.clientNote),
      ...(reviewReset ? {
        workflow_status: "PENDING_REVIEW" as const,
        reviewed_at: null,
        reviewed_by: null,
        active: false,
        submitted_at: now,
      } : pending ? { workflow_status: "PENDING_REVIEW" as const, submitted_at: now } : {}),
    },
  };
}

export function buildClientServiceSubmission(current: Pick<ClientServiceRecord, "workflow_status">, now: string) {
  if (current.workflow_status === "INACTIVE") throw new Error("SERVICE_INACTIVE");
  if (current.workflow_status === "REVIEWED") throw new Error("SERVICE_ALREADY_REVIEWED");
  return {
    workflow_status: "PENDING_REVIEW" as const,
    submitted_at: now,
    needs_info_message: null,
    reviewed_at: null,
    reviewed_by: null,
    active: false,
  };
}

export function getClientServiceStatusLabel(status: ServiceWorkflowStatus) {
  return ({
    DRAFT: "Rascunho",
    PENDING_REVIEW: "Em análise",
    NEEDS_INFO: "Precisa de informação",
    REVIEWED: "Pronto para emitir",
    INACTIVE: "Inativo",
  } as const)[status];
}

export function canClientEditService(status: ServiceWorkflowStatus) {
  return status !== "INACTIVE";
}

export function canOfficeApproveService(status: ServiceWorkflowStatus, createdVia: ServiceCreatedVia) {
  return status === "PENDING_REVIEW" || (createdVia === "OFFICE" && status === "DRAFT");
}

export function buildOfficeServiceApproval(status: ServiceWorkflowStatus, createdVia: ServiceCreatedVia, now: string, reviewerUserId: string) {
  if (!canOfficeApproveService(status, createdVia)) throw new Error("SERVICE_WORKFLOW_NOT_APPROVABLE");
  return { workflow_status: "REVIEWED" as const, reviewed_at: now, reviewed_by: reviewerUserId, active: true, needs_info_message: null };
}

export function buildServiceInformationRequest(status: ServiceWorkflowStatus, message: string, submittedAt: string | null, now: string) {
  if (status !== "PENDING_REVIEW") throw new Error("SERVICE_NOT_PENDING_REVIEW");
  const normalizedMessage = message.trim();
  if (normalizedMessage.length < 10) throw new Error("SERVICE_INFORMATION_MESSAGE_REQUIRED");
  return { workflow_status: "NEEDS_INFO" as const, needs_info_message: normalizedMessage, submitted_at: submittedAt ?? now, active: false, reviewed_at: null, reviewed_by: null };
}
