export const clientIssuanceSteps = ["Tomador", "Serviço", "Valores", "Revisão", "Emitir"] as const;
export type ClientIssuanceStep = 0 | 1 | 2 | 3 | 4;

export function canAdvanceClientIssuance(input: {
  step: ClientIssuanceStep;
  hasCustomer: boolean;
  hasService: boolean;
  amount: string;
  date: string;
  description: string;
}) {
  if (input.step === 0) return input.hasCustomer;
  if (input.step === 1) return input.hasService;
  if (input.step === 2) return Boolean(input.amount && input.date && input.description.trim().length >= 3);
  return true;
}

export function isEligibleClientIssuanceService(input: { active: boolean; workflowStatus: string; readiness: boolean }) {
  return input.active && input.readiness && (input.workflowStatus === "REVIEWED" || input.workflowStatus === "AUTO_READY");
}

/**
 * Keeps the catalog selection UI honest: only the existing server-side
 * workflow can affirm that a selected catalog service is ready to issue.
 */
export function getCatalogSelectionOutcome(input: { autoReady?: boolean; service?: { id?: string; name?: string } }) {
  if (input.autoReady && input.service?.id && input.service.name) {
    return { ready: true, message: "Serviço pronto para emissão." } as const;
  }
  return {
    ready: false,
    message: "Este serviço precisa de uma configuração antes de ser usado nesta nota.",
  } as const;
}

/** Merges server-paginated catalog pages without duplicating a service row. */
export function mergeCatalogPage<T extends { id: string }>(current: T[], incoming: T[], page: number) {
  if (page === 0) return incoming;
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !ids.has(item.id))];
}
