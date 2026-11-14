import "server-only";
import { env } from "cloudflare:workers";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(connectionString: string): PrismaClient {
  // Hyperdrive owns the connection pool. A Worker request must not reuse a
  // module-scoped pg socket/client across requests.
  const adapter = new PrismaPg({ connectionString, maxUses: 1 });
  return new PrismaClient({ adapter });
}

/**
 * Cloudflare Workers (Vinext): use the HYPERDRIVE binding injected by
 * cloudflare:workers. Local Node.js tooling keeps using DATABASE_URL.
 *
 * A fresh client is created for each Worker invocation because Workers
 * cannot safely reuse a live pg socket across requests. Node.js keeps the
 * existing process-level singleton for local development and scripts.
 */
export function getPrisma(connectionString?: string): PrismaClient {
  if (connectionString) return createPrismaClient(connectionString);

  const hyperdriveConnectionString = env.HYPERDRIVE?.connectionString;
  if (hyperdriveConnectionString) {
    return createPrismaClient(hyperdriveConnectionString);
  }

  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Database is not configured: HYPERDRIVE binding or DATABASE_URL is required.",
    );
  }

  const client = createPrismaClient(databaseUrl);
  globalForPrisma.prisma = client;
  return client;
}
