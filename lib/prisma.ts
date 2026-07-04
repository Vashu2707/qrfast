import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare const globalThis: {
  prismaGlobal?: PrismaClient;
};

function getPrismaClient(): PrismaClient {
  if (globalThis.prismaGlobal) return globalThis.prismaGlobal;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    maxConnections: 30,
    connectionTimeoutMillis: 30000,
    log: ["error", "warn"],
  });
  globalThis.prismaGlobal = client;
  return client;
}

const prisma = getPrismaClient();

export default prisma;
