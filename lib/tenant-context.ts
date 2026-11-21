/**
 * Async-local tenant scope used by the Prisma proxy to inject `tenantId`
 * into every tenant-scoped query and mutation.
 *
 * The scope is set when a request resolves its authenticated user (or a
 * signed QR token), so all awaited work in that chain inherits it.
 */
import { AsyncLocalStorage } from "async_hooks";

export type TenantScopeKind = "RESTAURANT" | "HOTEL";

export interface TenantScope {
  id: string;
  kind: TenantScopeKind;
}

const storage = new AsyncLocalStorage<TenantScope>();

export function getTenantScope(): TenantScope | undefined {
  return storage.getStore();
}

export function runWithTenantScope<T>(scope: TenantScope, fn: () => T): T {
  return storage.run(scope, fn);
}

/** Attach a scope to the current async chain (server action / page render). */
export function setTenantScope(scope: TenantScope): void {
  storage.enterWith(scope);
}
