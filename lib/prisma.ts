/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getTenantScope, type TenantScope } from "@/lib/tenant-context";
import { resolveRequestTenant } from "@/lib/request-tenant";

type DriverError = {
  message?: string;
  code?: string;
  cause?: { message?: string };
};

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

function isPoolError(err: unknown): boolean {
  const e = err as DriverError;
  return (
    (typeof e.message === "string" && e.message.includes("EMAXCONNSESSION")) ||
    e.code === "EMAXCONNSESSION" ||
    (typeof e.cause?.message === "string" &&
      e.cause.message.includes("EMAXCONNSESSION"))
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isPoolError(err) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return withRetry(fn, attempt + 1);
    }

    throw err;
  }
}

let prismaClient: PrismaClient | undefined;

function getPoolerUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required to initialize Prisma.");
  try {
    const url = new URL(raw);
    if (url.hostname.includes("pooler.supabase.com") && url.port === "5432") {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;
  const connectionString = getPoolerUrl();
  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  prismaClient = client;
  return client;
}

export function prismaWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn);
}

/** Delegates whose rows carry a tenantId column. */
// Identity lookups are keyed by a globally unique Supabase user id. Scoping
// them would make sign-in/bootstrap depend on an already-resolved tenant.
const TENANT_DELEGATES = new Set([
  "settings",
  "table",
  "category",
  "menuItem",
  "variant",
  "addon",
  "order",
  "orderItem",
  "payment",
  "offer",
  "review",
  "notification",
  "invoice",
  "hotelSettings",
  "hotelRoomType",
  "hotelRoom",
  "hotelBooking",
]);

/** Relation names used by nested Prisma writes, mapped to their delegate key. */
const NESTED_RELATIONS: Record<string, Record<string, string>> = {
  table: { orders: "order" },
  category: { children: "category", menuItems: "menuItem" },
  menuItem: {
    variants: "variant",
    addons: "addon",
    orderItems: "orderItem",
    reviews: "review",
  },
  order: {
    orderItems: "orderItem",
    payments: "payment",
    reviews: "review",
    invoices: "invoice",
  },
  hotelRoomType: { rooms: "hotelRoom", bookings: "hotelBooking" },
  hotelRoom: { bookings: "hotelBooking" },
};

const WHERE_METHODS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const CREATE_DATA_METHODS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array)
  );
}

function withTenantWhere(where: any, tenantId: string): any {
  if (where === undefined) return { tenantId };
  if (!isPlainObject(where) || "tenantId" in where) return where;
  return { ...where, tenantId };
}

function injectTenantIntoCreate(data: any, delegateKey: string, tenantId: string): any {
  if (Array.isArray(data)) {
    return data.map((row) => injectTenantIntoCreate(row, delegateKey, tenantId));
  }
  if (!isPlainObject(data)) return data;

  const result: Record<string, any> = { ...data };
  if (TENANT_DELEGATES.has(delegateKey) && result.tenantId === undefined) {
    result.tenantId = tenantId;
  }

  const relations = NESTED_RELATIONS[delegateKey] ?? {};
  for (const [key, value] of Object.entries(result)) {
    const nestedDelegate = relations[key];
    if (nestedDelegate && value !== null && typeof value === "object") {
      result[key] = injectTenantIntoRelation(value, nestedDelegate, tenantId);
    }
  }
  return result;
}

function injectTenantIntoRelation(value: any, delegateKey: string, tenantId: string): any {
  if (Array.isArray(value)) {
    return value.map((row) => injectTenantIntoRelation(row, delegateKey, tenantId));
  }
  if (!isPlainObject(value)) return value;

  const result: Record<string, any> = { ...value };
  if ("create" in result) {
    result.create = injectTenantIntoCreate(result.create, delegateKey, tenantId);
  }
  if ("createMany" in result) {
    const many = result.createMany;
    if (Array.isArray(many)) {
      result.createMany = many.map((row) =>
        injectTenantIntoCreate(row, delegateKey, tenantId)
      );
    } else if (isPlainObject(many) && "data" in many) {
      result.createMany = {
        ...many,
        data: injectTenantIntoCreate(many.data, delegateKey, tenantId),
      };
    }
  }
  if ("connectOrCreate" in result) {
    const connect = result.connectOrCreate;
    if (Array.isArray(connect)) {
      result.connectOrCreate = connect.map((row) =>
        isPlainObject(row) && "create" in row
          ? { ...row, create: injectTenantIntoCreate(row.create, delegateKey, tenantId) }
          : row
      );
    } else if (isPlainObject(connect) && "create" in connect) {
      result.connectOrCreate = {
        ...connect,
        create: injectTenantIntoCreate(connect.create, delegateKey, tenantId),
      };
    }
  }
  return result;
}

function applyScope(
  target: any,
  method: string,
  args: any[],
  delegateKey: string,
  scope: TenantScope
): any {
  // findUnique cannot be filtered by a non-unique tenantId on every model;
  // findFirst has identical nullable semantics and accepts the extra filter.
  if (method === "findUnique" || method === "findUniqueOrThrow") {
    const first = args[0];
    if (!isPlainObject(first)) return target[method](...args);
    const nextMethod = method === "findUnique" ? "findFirst" : "findFirstOrThrow";
    return target[nextMethod](
      { ...first, where: withTenantWhere(first.where, scope.id) },
      ...args.slice(1)
    );
  }

  const first = args[0];
  if (!isPlainObject(first)) {
    if (WHERE_METHODS.has(method)) {
      return target[method]({ where: { tenantId: scope.id } });
    }
    return target[method](...args);
  }

  const scoped: Record<string, any> = { ...first };
  if (WHERE_METHODS.has(method)) {
    scoped.where = withTenantWhere(scoped.where, scope.id);
  }
  if (CREATE_DATA_METHODS.has(method)) {
    scoped.data = injectTenantIntoCreate(scoped.data, delegateKey, scope.id);
  }
  if (method === "upsert") {
    scoped.where = withTenantWhere(scoped.where, scope.id);
    scoped.create = injectTenantIntoCreate(scoped.create, delegateKey, scope.id);
  }
  return target[method](scoped, ...args.slice(1));
}

function callScoped(
  target: any,
  method: string,
  args: any[],
  delegateKey: string
): any {
  if (!TENANT_DELEGATES.has(delegateKey)) {
    return target[method](...args);
  }

  // An explicit scope from runWithTenantScope (scripts/token flows) wins.
  const explicit = getTenantScope();
  if (explicit) return applyScope(target, method, args, delegateKey, explicit);

  // Otherwise resolve from Next's request-local cookie store at query time.
  // This works even when the scope was set by an async helper the caller is
  // awaiting, which enterWith/AsyncLocalStorage cannot do.
  return resolveRequestTenant().then((scope) =>
    scope
      ? applyScope(target, method, args, delegateKey, scope)
      : target[method](...args)
  );
}

function wrapDelegate(delegate: any, delegateKey: string): any {
  return new Proxy(delegate, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== "function") return value;
      if (prop === "findUnique" || prop === "findUniqueOrThrow") {
        return (...args: any[]) => callScoped(target, prop as string, args, delegateKey);
      }
      return (...args: any[]) => callScoped(target, prop as string, args, delegateKey);
    },
  });
}

function wrapClient(client: any): any {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "$transaction") {
        return (...args: any[]) => {
          // Interactive transactions hand the callback a fresh client; wrap
          // that client too so every tx.* call is scoped. Array-form
          // transactions already contain scoped PrismaPromises.
          if (typeof args[0] === "function") {
            const callback = args[0];
            return target.$transaction((tx: any) => callback(wrapClient(tx)));
          }
          return target.$transaction(...args);
        };
      }

      const value = Reflect.get(target, prop);
      if (
        typeof prop === "string" &&
        TENANT_DELEGATES.has(prop) &&
        value !== null &&
        typeof value === "object"
      ) {
        return wrapDelegate(value, prop);
      }
      if (typeof value === "function") return value.bind(target);
      return value;
    },
  });
}

const prismaProxy = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return wrapClient(getPrisma())[prop as keyof PrismaClient];
  },
});

export default prismaProxy;
