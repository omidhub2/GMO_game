import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTelegramInitData } from "./telegram-auth";

const token = "123456:test-bot-secret";
const now = 1_800_000_000_000;
function signedData(authDate = now / 1000) {
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify({ id: 1234567890123, first_name: "Player" }), query_id: "test-query" });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

describe("Telegram Mini App sign-in", () => {
  it("accepts signed Telegram data including large user IDs", () => {
    expect(validateTelegramInitData(signedData(), token, 3600, now).id).toBe(1234567890123);
  });
  it("rejects forged user identity and a token from another bot", () => {
    const forged = new URLSearchParams(signedData());
    forged.set("user", JSON.stringify({ id: 42, first_name: "Attacker" }));
    expect(() => validateTelegramInitData(forged.toString(), token, 3600, now)).toThrow();
    expect(() => validateTelegramInitData(signedData(), "other-bot", 3600, now)).toThrow();
  });
  it("rejects expired and future sign-in data", () => {
    expect(() => validateTelegramInitData(signedData(now / 1000 - 3601), token, 3600, now)).toThrow();
    expect(() => validateTelegramInitData(signedData(now / 1000 + 60), token, 3600, now)).toThrow();
  });
  it("rejects duplicate fields and malformed signatures", () => {
    expect(() => validateTelegramInitData(`${signedData()}&auth_date=1`, token, 3600, now)).toThrow();
    expect(() => validateTelegramInitData("hash=00", token, 3600, now)).toThrow();
  });
});
