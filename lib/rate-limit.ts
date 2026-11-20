import { headers } from "next/headers";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ── Fallback store (development only) ────────────────────────────────────────
// Process-local Map: counters reset on every restart/deploy and are not shared
// between instances. Used only when Upstash is unconfigured AND we're not in
// production — production fails closed (see checkRateLimit).
const store = new Map<string, RateLimitEntry>();

// Evict stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// ── Shared store (Upstash Redis) ─────────────────────────────────────────────
// Counters live in Redis: they survive deploys/restarts and are shared across
// instances. Configure via UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// (see .env.example — create a free Redis database at upstash.com).
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// One Ratelimit instance per (max, window) combination — each call site uses a
// different budget, and instances are cheap wrappers over the shared Redis.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const cacheKey = `${maxRequests}/${windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms` as Duration),
      analytics: false,
      prefix: "qrfast:ratelimit",
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

let warnedMissingConfig = false;

/**
 * Sliding-window rate limit. Async — always `await` it.
 *
 * Production: requires Upstash (fails closed if unconfigured so brute-force
 * limits can't silently be off). Transient Redis errors fail OPEN with a loud
 * log — an Upstream outage must not lock staff out of sign-in; the window is
 * short-lived, so exposure is bounded.
 * Development: falls back to the in-process Map (per-restart counters).
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const result = await getLimiter(maxRequests, windowMs).limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        retryAfterMs: result.success ? 0 : Math.max(result.reset - Date.now(), 0),
      };
    } catch (error) {
      console.error("rate-limit: Redis unavailable — failing open for this request:", error);
      return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
    }
  }

  if (process.env.NODE_ENV === "production") {
    // Fail closed, same posture as SESSION_SECRET in lib/session.ts: an
    // unconfigured limiter is indistinguishable from no limiter at all.
    throw new Error(
      "Rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. " +
        "Create a Redis database at https://upstash.com and set both (see .env.example)."
    );
  }

  if (!warnedMissingConfig) {
    warnedMissingConfig = true;
    console.warn(
      "rate-limit: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — using in-process fallback (resets each restart)."
    );
  }

  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * IP-trust note: we take the FIRST x-forwarded-for entry. That is only
 * trustworthy when a reverse proxy we control overwrites/starts the header
 * (Vercel, Cloudflare, nginx with `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for`). If the app is ever exposed directly, a caller
 * can forge the header and rotate IPs to dodge per-IP limits — deploy behind a
 * proxy that sets this header (see BUG-REPORT #15).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function getServerActionIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
