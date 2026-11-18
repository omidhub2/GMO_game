import { AsyncLocalStorage } from "node:async_hooks";

type RequestDatabaseContext = {
  connectionString: string;
  client?: unknown;
};

type DatabaseContextGlobal = typeof globalThis & {
  __gmoDatabaseConnectionStorage?: AsyncLocalStorage<RequestDatabaseContext>;
};

const globalForDatabaseContext = globalThis as DatabaseContextGlobal;
const databaseConnectionStorage =
  (globalForDatabaseContext.__gmoDatabaseConnectionStorage ??= new AsyncLocalStorage<RequestDatabaseContext>());

export function withDatabaseConnection<T>(connectionString: string, callback: () => T): T {
  return databaseConnectionStorage.run({ connectionString }, callback);
}

export function getRequestDatabaseConnection(): string | undefined {
  return databaseConnectionStorage.getStore()?.connectionString;
}

export function getRequestDatabaseClient<T>(): T | undefined {
  return databaseConnectionStorage.getStore()?.client as T | undefined;
}

export function setRequestDatabaseClient<T>(client: T): void {
  const context = databaseConnectionStorage.getStore();
  if (!context) throw new Error("Request database context is unavailable.");
  context.client = client;
}

/** Close the request-scoped Prisma pool after the response has been produced. */
export async function closeRequestDatabase(): Promise<void> {
  const context = databaseConnectionStorage.getStore();
  const client = context?.client as { $disconnect?: () => Promise<void> } | undefined;
  if (!client) return;
  context!.client = undefined;
  await client.$disconnect?.();
}
