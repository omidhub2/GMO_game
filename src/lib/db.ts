import "server-only";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRequestDatabaseConnection } from "./db-context";

const globalForPrisma = globalThis as unknown as {
  prismaByConnectionString?: Map<string, PrismaClient>;
};

function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Workers obtain the request-scoped connection string from Hyperdrive.
 * Node.js development and tests continue to use DATABASE_URL.
 *
 * Prisma clients are reused per connection string so requests do not create
 * an unbounded number of pools in a long-lived Worker isolate.
 */
export function getPrisma(connectionString?: string): PrismaClient {
  const resolvedConnectionString =
    connectionString ??
    getRequestDatabaseConnection() ??
    process.env.DATABASE_URL;

  if (!resolvedConnectionString) {
    throw new Error("Database connection is not configured. Bind Hyperdrive or set DATABASE_URL.");
  }

  const clients = (globalForPrisma.prismaByConnectionString ??= new Map<string, PrismaClient>());
  let client = clients.get(resolvedConnectionString);

  if (!client) {
    client = createPrismaClient(resolvedConnectionString);
    clients.set(resolvedConnectionString, client);
  }

  return client;
}
