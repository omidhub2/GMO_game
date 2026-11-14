import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString, maxUses: 1 });
  return new PrismaClient({ adapter });
}

/**
 * Cloudflare Workers resolve this application's own HYPERDRIVE binding
 * from the OpenNext request context. Local Node tooling uses DATABASE_URL.
 * No HomeNoh/Khaneno database configuration is referenced.
 */
export function getPrisma(connectionString?: string): PrismaClient {
  if (connectionString) return createPrismaClient(connectionString);

  try {
    const connection = getCloudflareContext().env.HYPERDRIVE?.connectionString;
    if (connection) return createPrismaClient(connection);
  } catch {
    // No Cloudflare request context: use the local Node.js configuration.
  }

  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Database is not configured: GMO Arena HYPERDRIVE binding or DATABASE_URL is required.",
    );
  }

  const client = createPrismaClient(databaseUrl);
  globalForPrisma.prisma = client;
  return client;
}
