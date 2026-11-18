import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { is_bot?: boolean };
  };
};

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!secret || !token) return NextResponse.json({ ok: false }, { status: 503 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim() ?? "";
  // Telegram deep links (?start=login) arrive as "/start login".
  // Also accept a literal "/login" command for users who type it.
  const loginCommand = /^\/(?:login(?:@\w+)?|start(?:@\w+)?\s+login)(?:\s|$)/i.test(text);
  const startCommand = /^\/start(?:@\w+)?(?:\s|$)/i.test(text);
  if (!chatId || message?.from?.is_bot || (!startCommand && !loginCommand)) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.APP_URL?.trim() || "https://gmo-arena.omidhub-ai.workers.dev";
  const welcome = [
    loginCommand ? "🎮 ورود دوباره به GMO Arena" : "🎮 به GMO Arena خوش آمدید!",
    "",
    loginCommand
      ? "برای ورود مستقیم به بازی، دکمه زیر را بزنید. اگر GMO Arena روی گوشی نصب باشد، می‌توانید نسخه نصب‌شده را باز کنید؛ در غیر این صورت بازی در تلگرام اجرا می‌شود."
      : "برای ورود امن به بازی، دکمه زیر را بزنید. شناسه تلگرام شما هنگام بازشدن Mini App به‌صورت امن تأیید می‌شود.",
    "",
    "🏆 آماده ورود به میدان هستید؟"
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: new URL("/images/telegram-mini-app-640x360.png", appUrl).toString(),
        caption: welcome,
        reply_markup: {
          inline_keyboard: [[{ text: "🎮 ورود به بازی GMO Arena", web_app: { url: appUrl } }]]
        }
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      console.error("[telegram-webhook] sendPhoto failed", response.status);
    }
  } catch (error) {
    console.error("[telegram-webhook] Telegram API request failed", error instanceof Error ? error.name : "UnknownError");
  }

  return NextResponse.json({ ok: true });
}
