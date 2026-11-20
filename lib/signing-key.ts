/**
 * Shared HMAC key and helpers for signed cookies.
 *
 * Production refuses to start without SESSION_SECRET (NEXTAUTH_SECRET is
 * accepted as a fallback). Development uses an ephemeral per-process key so
 * `next dev` works unconfigured.
 */
import crypto from "crypto";

function resolveSigningKey(): string {
  // `||` (not `??`): an empty string must count as missing.
  const key = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (key) return key;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Generate one (see .env.example) and add it to the environment — " +
        "without it signed cookies would be forgeable."
    );
  }

  console.warn(
    "[lib/signing-key] SESSION_SECRET not set — using an ephemeral dev-only key; signed cookies reset on restart."
  );
  return crypto.randomBytes(32).toString("hex");
}

const SIGNING_KEY = resolveSigningKey();

export function signValue(value: string): string {
  return crypto.createHmac("sha256", SIGNING_KEY).update(value).digest("hex");
}

/** Constant-time compare — `!==` can leak the expected HMAC via timing. */
export function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(provided, "utf-8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
