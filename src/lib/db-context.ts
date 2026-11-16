import { AsyncLocalStorage } from "node:async_hooks";

const databaseConnectionStorage = new AsyncLocalStorage<string>();

/**
 * Run a request inside its Cloudflare Hyperdrive connection context.
 * AsyncLocalStorage keeps the binding request-scoped without mutating process.env.
 */
export function withDatabaseConnection<T>(connectionString: string, callback: () => T): T {
  return databaseConnectionStorage.run(connectionString, callback);
}

export function getRequestDatabaseConnection(): string | undefined {
  return databaseConnectionStorage.getStore();
}
