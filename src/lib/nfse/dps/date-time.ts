/** Formats an instant using the timezone syntax required by TSDateTimeUTC. */
export function formatDpsDateTimeUtc(value: Date) {
  return value.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}
