import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Pass Hyperdrive's connectionString explicitly in Workers; Node.js uses DATABASE_URL. */
export function getPrisma(connectionString?: string): PrismaClient {
  if (connectionString) return createPrismaClient(connectionString);
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");

  const client = createPrismaClient(databaseUrl);
  globalForPrisma.prisma = client;
  return client;
}
