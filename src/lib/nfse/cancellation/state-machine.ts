import "server-only";

export type CancellationWorkflowStatus = "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "UNKNOWN" | "CANCELLED" | "REJECTED" | "DENIED" | "COMPLETED";

export function canRequestCancellation(invoiceStatus: string) {
  return invoiceStatus === "ISSUED";
}

export function cancellationReplayDecision(status: CancellationWorkflowStatus) {
  if (status === "CANCELLED" || status === "COMPLETED" || status === "REJECTED" || status === "DENIED") return "RETURN_FINAL" as const;
  if (status === "UNKNOWN") return "RECONCILE_ONLY" as const;
  return "IN_PROGRESS" as const;
}

/** The official cancellation transport remains intentionally closed in this release. */
export function assertCancellationTransmissionBlocked() {
  throw new Error("CANCELLATION_TRANSMISSION_BLOCKED");
}
