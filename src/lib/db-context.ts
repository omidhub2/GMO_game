import { AsyncLocalStorage } from "node:async_hooks";

type DatabaseContextGlobal = typeof globalThis & {
  __gmoDatabaseConnectionStorage?: AsyncLocalStorage<string>;
};

// Keep one store per Worker isolate, even if the bundler evaluates this module
// through more than one server/worker entry chunk.
const globalForDatabaseContext = globalThis as DatabaseContextGlobal;
const databaseConnectionStorage =
  (globalForDatabaseContext.__gmoDatabaseConnectionStorage ??= new AsyncLocalStorage<string>());

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
