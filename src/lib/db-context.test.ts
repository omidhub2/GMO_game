import { describe, expect, it } from "vitest";
import { closeRequestDatabase, getRequestDatabaseClient, getRequestDatabaseConnection, setRequestDatabaseClient, withDatabaseConnection } from "./db-context";

describe("request-scoped database connection", () => {

  it("keeps Prisma clients request-scoped and closes only the current request client", async () => {
    const firstClient = { closed: false, async $disconnect() { this.closed = true; } };
    const secondClient = { closed: false, async $disconnect() { this.closed = true; } };

    await Promise.all([
      withDatabaseConnection("postgresql://first.example/db", async () => {
        setRequestDatabaseClient(firstClient);
        await Promise.resolve();
        expect(getRequestDatabaseClient()).toBe(firstClient);
        await closeRequestDatabase();
        expect(firstClient.closed).toBe(true);
      }),
      withDatabaseConnection("postgresql://second.example/db", async () => {
        setRequestDatabaseClient(secondClient);
        await Promise.resolve();
        expect(getRequestDatabaseClient()).toBe(secondClient);
        await closeRequestDatabase();
        expect(secondClient.closed).toBe(true);
      }),
    ]);
    expect(getRequestDatabaseClient()).toBeUndefined();
  });
  it("keeps concurrent request connections isolated across async work", async () => {
    const [first, second] = await Promise.all([
      withDatabaseConnection("postgresql://first.example/db", async () => {
        await Promise.resolve();
        return getRequestDatabaseConnection();
      }),
      withDatabaseConnection("postgresql://second.example/db", async () => {
        await Promise.resolve();
        return getRequestDatabaseConnection();
      }),
    ]);

    expect(first).toBe("postgresql://first.example/db");
    expect(second).toBe("postgresql://second.example/db");
    expect(getRequestDatabaseConnection()).toBeUndefined();
  });
});
