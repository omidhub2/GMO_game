import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const telegramUser = z.object({
  id: z.number().int().positive().safe(),
  first_name: z.string().max(256),
  last_name: z.string().max(256).optional(),
  username: z.string().max(64).optional(),
});

export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 3600, now = Date.now()) {
  if (!botToken || !initData || initData.length > 16384) throw new Error("INVALID_TELEGRAM_DATA");
  const params = new URLSearchParams(initData);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new Error("INVALID_TELEGRAM_DATA");
  const hash = params.get("hash") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error("INVALID_TELEGRAM_DATA");
  params.delete("hash");
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) throw new Error("INVALID_TELEGRAM_DATA");
  const authDate = Number(params.get("auth_date"));
  const age = Math.floor(now / 1000) - authDate;
  if (!Number.isSafeInteger(authDate) || authDate <= 0 || age < -30 || age > maxAgeSeconds) throw new Error("TELEGRAM_DATA_EXPIRED");
  return telegramUser.parse(JSON.parse(params.get("user") ?? "null"));
}
