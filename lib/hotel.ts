import { randomBytes } from "crypto";

/** Booking statuses that occupy inventory (block overlapping bookings). */
export const BLOCKED_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

/** Parse a YYYY-MM-DD string as a UTC midnight date (date-only semantics). */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Today's calendar date as YYYY-MM-DD in the server's local timezone. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Today's calendar date (YYYY-MM-DD) in an IANA timezone — the hotel's
 * calendar day, which differs from the server's (and the browser's) whenever
 * their tz ≠ the property's. `tz` comes from HotelSettings.timezone
 * (default Asia/Kolkata); an invalid value degrades to server-local rather
 * than crashing.
 */
export function todayInTz(tz: string | null | undefined): string {
  const timeZone = tz || "Asia/Kolkata";
  try {
    // en-CA formats dates as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return todayISO();
  }
}

/** Whole nights between two date-only values (check-out day not counted). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

/** Human-friendly booking reference, e.g. HF-7K2M9X. */
export function generateBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
  return `HF-${code}`;
}
