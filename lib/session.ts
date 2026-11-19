/**
 * Application-level session timeout via a signed activity cookie.
 *
 * Even though Supabase JWTs have their own expiry, this enforces a shorter
 * re-authentication window for sensitive operations (password change, payment).
 *
 * The cookie is HMAC-signed to prevent tampering.
 */
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "session_activity";
/** How long a session is considered fresh (30 minutes). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Resolve the HMAC signing key once at boot.
 *
 * A missing key used to fall back to `HMAC("", ts)`, letting anyone forge the
 * freshness cookie that guards password changes — so production refuses to
 * start without one. Development falls back to a random per-process key so
 * `next dev` keeps working unconfigured (existing activity cookies invalidate
 * on restart, which is harmless in dev).
 */
function resolveSigningKey(): string {
  // `||` (not `??`): an empty string must count as missing.
  const key = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (key) return key;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Generate one (see .env.example) and add it to the environment — " +
        "without it the session-activity cookie would be forgeable."
    );
  }

  console.warn(
    "[lib/session] SESSION_SECRET not set — using an ephemeral dev-only key; session cookies reset on restart."
  );
  return crypto.randomBytes(32).toString("hex");
}

const SIGNING_KEY = resolveSigningKey();

function sign(value: string): string {
  return crypto.createHmac("sha256", SIGNING_KEY).update(value).digest("hex");
}

/** Constant-time signature compare — `!==` can leak the expected HMAC via timing. */
function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(provided, "utf-8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Set (or refresh) the session activity timestamp.
 * Call after successful sign-in and sensitive re-auth actions.
 */
export async function touchSession() {
  const ts = String(Date.now());
  const sig = sign(ts);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${ts}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TIMEOUT_MS / 1000,
  });
}

/**
 * Clear the session activity cookie.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Check whether the current session is still fresh.
 * Returns `{ fresh: true }` or `{ fresh: false, reason }`.
 */
export async function isSessionFresh(): Promise<
  { fresh: true } | { fresh: false; reason: string }
> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    return { fresh: false, reason: "No active session. Please sign in again." };
  }

  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) {
    return { fresh: false, reason: "Invalid session. Please sign in again." };
  }

  const ts = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  if (!signaturesMatch(sign(ts), sig)) {
    return { fresh: false, reason: "Session tampered. Please sign in again." };
  }

  const signedAt = Number(ts);
  if (!Number.isFinite(signedAt)) {
    return { fresh: false, reason: "Invalid session. Please sign in again." };
  }

  const elapsed = Date.now() - signedAt;
  if (elapsed > SESSION_TIMEOUT_MS) {
    return {
      fresh: false,
      reason: "Session expired. Please sign in again to continue.",
    };
  }

  return { fresh: true };
}
