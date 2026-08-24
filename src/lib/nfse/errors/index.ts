export class SafeFiscalError extends Error {
  constructor(public readonly code: string, public readonly safeMessage: string, public readonly retryable = false) { super(safeMessage); this.name = "SafeFiscalError"; }
}
export const safeConfigurationError = new SafeFiscalError("FISCAL_CONFIGURATION_REVIEW", "Não conseguimos emitir esta nota porque existe uma configuração fiscal que precisa ser revisada pelo escritório.");
