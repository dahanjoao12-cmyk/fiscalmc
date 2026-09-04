const DPS_TIME_ZONE = "America/Sao_Paulo";

type DatePart = "year" | "month" | "day" | "hour" | "minute" | "second";

function dateParts(value: Date, timeZone: string): Record<DatePart, number> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const result = {} as Record<DatePart, number>;
  for (const part of parts) {
    if (["year", "month", "day", "hour", "minute", "second"].includes(part.type)) {
      result[part.type as DatePart] = Number(part.value);
    }
  }
  return result;
}

function offsetMinutes(value: Date, parts: Record<DatePart, number>) {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const instantWithoutMilliseconds = Math.floor(value.getTime() / 1_000) * 1_000;
  return Math.round((localAsUtc - instantWithoutMilliseconds) / 60_000);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Formats the same instant for the DPS using the issuer's IANA timezone.
 * TSDateTimeUTC requires an explicit offset and does not allow milliseconds.
 */
export function formatDpsDateTimeSaoPaulo(value: Date) {
  const parts = dateParts(value, DPS_TIME_ZONE);
  const offset = offsetMinutes(value, parts);
  const sign = offset < 0 ? "-" : "+";
  const absoluteOffset = Math.abs(offset);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}
