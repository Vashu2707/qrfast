/**
 * Request-scoped tenant resolution for the Prisma proxy.
 *
 * `AsyncLocalStorage.enterWith()` only affects the remainder of the async
 * chain it was called in — it does NOT propagate back to a caller that is
 * already awaiting the function. That made scope set inside `getCurrentUser()`
 * invisible to the queries in the action/page that called it, so every query
 * ran unscoped.
 *
 * Next.js exposes its own request-local cookie store, which IS stable for the
 * whole request. We key explicit tenant overrides on that store, so a scope
 * resolved once (from the DB user or a signed QR token) is visible to every
 * query in the same request, regardless of async nesting.
 */
import { cookies } from "next/headers";
import { signValue, signaturesMatch } from "@/lib/signing-key";
import { setTenantScope, type TenantScope } from "@/lib/tenant-context";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const overrides = new WeakMap<CookieStore, TenantScope>();

async function getCookieStore(): Promise<CookieStore | null> {
  try {
    return await cookies();
  } catch {
    // Scripts / code paths outside a Next.js request.
    return null;
  }
}

/** Set the authoritative tenant for the current request. */
export async function setActiveTenant(scope: TenantScope): Promise<void> {
  // Keep the ALS scope too: runWithTenantScope callers (scripts, token flows)
  // rely on it, and it is harmless when it does not propagate.
  setTenantScope(scope);
  const store = await getCookieStore();
  if (store) overrides.set(store, scope);
}

/** Resolve the tenant at query time, in the query's own async context. */
export async function resolveRequestTenant(): Promise<TenantScope | undefined> {
  const store = await getCookieStore();
  if (!store) return undefined;

  const override = overrides.get(store);
  if (override) return override;

  // Anonymous public routes have no authenticated user. A signed cookie is
  // the only durable tenant hint; token-driven flows set an explicit override
  // before they query, which takes precedence above.
  const raw = store.get("qrfast_tenant")?.value;
  if (!raw) return undefined;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return undefined;
  const payload = raw.slice(0, dot);
  if (!signaturesMatch(signValue(payload), raw.slice(dot + 1))) return undefined;
  const separator = payload.indexOf(":");
  if (separator === -1) return undefined;
  const kind = payload.slice(0, separator);
  const id = payload.slice(separator + 1);
  if ((kind === "RESTAURANT" || kind === "HOTEL") && id) {
    return { id, kind };
  }
  return undefined;
}
