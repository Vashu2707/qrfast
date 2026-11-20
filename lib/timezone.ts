/**
 * Calendar-day helpers for an IANA timezone (e.g. Asia/Kolkata).
 *
 * The restaurant and hotel each configure their own timezone; the server may
 * be hosted in a different one. Using the server's local day (or UTC via
 * toISOString) makes "today" and chart buckets disagree with the business's
 * calendar day. All day keys in analytics/validation go through here.
 */

const DEFAULT_TZ = "Asia/Kolkata";

function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    // Throws on an unknown zone — degrade instead of crashing a dashboard.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** YYYY-MM-DD for an instant in `tz` (en-CA formats dates that way). */
export function dateKeyInTz(date: Date, tz: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's YYYY-MM-DD in `tz`. */
export function todayInTz(tz: string | null | undefined): string {
  return dateKeyInTz(new Date(), tz);
}

/** YYYY-MM-DD using the server's own local calendar (fallback only). */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % 24, // en-US can emit "24" for midnight
    part("minute"),
    part("second")
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The UTC instant of 00:00 on a YYYY-MM-DD key in `tz`. Two passes so a DST
 * shift near midnight doesn't pick the previous day's offset.
 */
export function startOfDayInTz(dateKey: string, tz: string | null | undefined): Date {
  const timeZone = safeTimeZone(tz);
  const utcMidnight = new Date(`${dateKey}T00:00:00.000Z`);
  const firstGuess = new Date(
    utcMidnight.getTime() - tzOffsetMinutes(utcMidnight, timeZone) * 60_000
  );
  return new Date(
    utcMidnight.getTime() - tzOffsetMinutes(firstGuess, timeZone) * 60_000
  );
}
