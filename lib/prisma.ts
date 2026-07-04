import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare const globalThis: {
  prismaGlobal?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  if (globalThis.prismaGlobal) return globalThis.prismaGlobal;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }
  const pool = new Pool({
    connectionString,
    max: 30,
    connectionTimeoutMillis: 30000,
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  globalThis.prismaGlobal = client;
  return client;
}

const prisma = getPrismaClient();

export default prisma;
