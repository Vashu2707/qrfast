import { headers } from "next/headers";
import Redis from "ioredis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ── Fallback store (development only) ────────────────────────────────────────
// Process-local Map: counters reset on every restart/deploy and are not shared
// between instances. Used only when Redis is unconfigured AND we're not in
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

// ── Shared store (Redis) ─────────────────────────────────────────────────────
// Counters live in Redis: they survive deploys/restarts and are shared across
// instances. Configure via REDIS_URL (see .env.example — any Redis server that
// supports EVAL works, e.g. Redis Cloud, ElastiCache or a self-hosted instance).
const REDIS_URL = process.env.REDIS_URL;
const KEY_PREFIX = "qrfast:ratelimit:";
let warnedMissingConfig = false;

// Atomic sliding-window log: drop old hits, count the rest, and either record
// this hit or report when the oldest hit expires. One EVAL keeps concurrent
// requests from racing past the limit.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {1, max - count - 1, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retry = 0
if oldest[2] then
  retry = math.max(tonumber(oldest[2]) + window - now, 0)
end
return {0, 0, math.ceil(retry)}
`;

// Reuse one connection across warm serverless invocations and HMR reloads.
// Reconnecting on every request would exhaust the server's connection limit.
const globalForRedis = globalThis as typeof globalThis & {
  __qrfastRedis?: Redis;
};

function getRedis(): Redis {
  if (!globalForRedis.__qrfastRedis) {
    const client = new Redis(REDIS_URL!, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    // Without a listener ioredis emits an unhandled 'error' event.
    client.on("error", (error) => {
      console.error("rate-limit: Redis connection error:", error);
    });
    globalForRedis.__qrfastRedis = client;
  }
  return globalForRedis.__qrfastRedis;
}

/**
 * Sliding-window rate limit. Async — always `await` it.
 *
 * Production: requires Redis (fails closed if unconfigured so brute-force
 * limits can't silently be off). Transient Redis errors fail OPEN with a loud
 * log — a Redis outage must not lock staff out of sign-in; the window is
 * short-lived, so exposure is bounded.
 * Development: falls back to the in-process Map (per-restart counters).
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (REDIS_URL) {
    try {
      const now = Date.now();
      // Unique member: two hits in the same millisecond must not overwrite
      // each other in the sorted set.
      const member = `${now}-${Math.random().toString(36).slice(2)}`;
      const result = (await getRedis().eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        `${KEY_PREFIX}${key}`,
        now,
        windowMs,
        maxRequests,
        member
      )) as [string | number, string | number, string | number];
      const [allowed, remaining, retryAfterMs] = result;

      return {
        allowed: Number(allowed) === 1,
        remaining: Number(remaining),
        retryAfterMs: Number(retryAfterMs),
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
      "Rate limiting requires REDIS_URL. Set it to a Redis connection string " +
        "(e.g. rediss://user:password@host:port) — see .env.example."
    );
  }

  if (!warnedMissingConfig) {
    warnedMissingConfig = true;
    console.warn(
      "rate-limit: REDIS_URL not set — using in-process fallback (resets each restart)."
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
