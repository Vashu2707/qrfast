import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare const globalThis: {
  prismaGlobal?: PrismaClient;
};

function getClient(): PrismaClient {
  if (globalThis.prismaGlobal) return globalThis.prismaGlobal;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  if (process.env.NODE_ENV !== "production") {
    globalThis.prismaGlobal = client;
  }
  return client;
}

const prisma = new Proxy<PrismaClient>({} as PrismaClient, {
  get(_, prop) {
    return Reflect.get(getClient(), prop);
  },
});

export default prisma;
