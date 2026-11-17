import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const appUrl = process.env.APP_URL?.trim();
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
if (!token) throw new Error("Fill TELEGRAM_BOT_TOKEN in .env with the BotFather token.");
if (!webhookSecret || !/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  throw new Error("Set TELEGRAM_WEBHOOK_SECRET in .env (1-256 letters, numbers, _ or -) and upload the same value as a Worker secret.");
}
const url = new URL(appUrl || "http://localhost");
if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("APP_URL must be the public HTTPS Mini App URL.");

async function call(method, body) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("Telegram API could not be reached."); }
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram rejected ${method}. Check your bot token and app URL.`);
  return data.result;
}

const bot = await call("getMe", {});
const configuredUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
if (configuredUsername && configuredUsername.toLowerCase() !== bot.username.toLowerCase()) throw new Error("TELEGRAM_BOT_USERNAME does not match this token.");

await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Play GMO Arena", web_app: { url: url.toString() } } });
await call("setMyCommands", { commands: [{ command: "start", description: "Start GMO Arena and get installation instructions" }] });
await call("setWebhook", {
  url: new URL("/api/telegram/webhook", url).toString(),
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false
});
console.log(`Telegram bot @${bot.username} configured: Mini App menu, /start welcome message, and secure webhook.`);
