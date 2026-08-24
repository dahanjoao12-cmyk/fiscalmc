export function parseMoneyToCents(value: string | number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 999_999_999.99) throw new Error("Valor monetário inválido.");
  return Math.round((numeric + Number.EPSILON) * 100);
}
