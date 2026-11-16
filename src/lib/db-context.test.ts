import { describe, expect, it } from "vitest";
import { getRequestDatabaseConnection, withDatabaseConnection } from "./db-context";

describe("request-scoped database connection", () => {
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
