import { SafeFiscalError } from "../errors";

export const issuanceStages = [
  "AUTH",
  "LOAD_DATA",
  "READINESS",
  "FISCAL_RESOLUTION",
  "RESERVE_DPS",
  "BUILD_DOCUMENT",
  "INVOICE_INSERT",
  "AUDIT_INSERT",
  "CLAIM_SUBMISSION",
  "PREPARE_DPS",
  "PROVIDER_CALL",
] as const;

export type IssuanceStage = (typeof issuanceStages)[number];

type DatabaseError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function systemIdentifier(value: string, label: "constraint" | "table" | "column") {
  const expression = label === "table"
    ? /relation\s+"([^"\r\n]+)"/i
    : new RegExp(`${label}\\s+"([^"\\r\\n]+)"`, "i");
  return value.match(expression)?.[1];
}

/** Keeps database structure useful for support while removing submitted values. */
export function sanitizeDatabaseDiagnostic(value: unknown) {
  const error = (value && typeof value === "object" ? value : {}) as DatabaseError;
  const message = text(error.message);
  const details = text(error.details);
  const hint = text(error.hint);
  const redactValues = (input: string) => input
    .replace(/(["'])[^"']*\1/g, "[redacted]")
    .replace(/=\([^)]*\)/g, "=[redacted]")
    .replace(/\b\d{11,14}\b/g, "[redacted]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[redacted]")
    .slice(0, 300);

  return {
    ...(text(error.code) ? { postgresCode: text(error.code) } : {}),
    ...(systemIdentifier(message, "constraint") ? { constraint: systemIdentifier(message, "constraint") } : {}),
    ...(systemIdentifier(message, "table") ? { table: systemIdentifier(message, "table") } : {}),
    ...(systemIdentifier(message, "column") ? { column: systemIdentifier(message, "column") } : {}),
    ...(message ? { message: redactValues(message) } : {}),
    ...(details ? { details: redactValues(details) } : {}),
    ...(hint ? { hint: redactValues(hint) } : {}),
  };
}

export function issuanceFailureDiagnostic(stage: IssuanceStage, error: unknown) {
  if (error instanceof SafeFiscalError) {
    return { stage, errorClass: error.name, safeCode: error.code };
  }

  const message = error instanceof Error ? error.message : "UNKNOWN";
  const database = sanitizeDatabaseDiagnostic(error);
  return {
    stage,
    errorClass: error instanceof Error ? error.name : "UnknownError",
    safeCode: message === "INVOICE_PERSIST_FAILED" ? message : "INVOICE_REQUEST_FAILED",
    ...database,
  };
}
