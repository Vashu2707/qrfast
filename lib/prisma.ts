import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type DriverError = {
  message?: string;
  code?: string;
  cause?: { message?: string };
};

declare const globalThis: {
  prismaGlobal?: PrismaClient;
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

function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }
  const pool = new Pool({
    connectionString,
    max: 3,
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

export default new Proxy({} as PrismaClient, {
  get(_, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});
