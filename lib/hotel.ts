import { randomBytes } from "crypto";
import { dateKeyInTz, todayInTz } from "@/lib/timezone";

// Re-exported for the hotel call sites — the shared implementation now also
// serves restaurant analytics, which must use the same calendar-day semantics.
export { todayInTz };

/** Booking statuses that occupy inventory (block overlapping bookings). */
export const BLOCKED_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

/** Parse a YYYY-MM-DD string as a UTC midnight date (date-only semantics). */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** True when a YYYY-MM-DD value is a real calendar date (not e.g. 2026-02-31). */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseDateOnly(value);
  return !Number.isNaN(parsed.getTime()) && dateKeyInTz(parsed, "UTC") === value;
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
