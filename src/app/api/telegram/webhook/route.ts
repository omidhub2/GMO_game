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
  if (!chatId || message?.from?.is_bot || !/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.APP_URL?.trim() || "https://gmo-arena.omidhub-ai.workers.dev";
  const welcome = [
    "🎮 به GMO Arena خوش آمدید!",
    "",
    "برای ورود امن به بازی، دکمه زیر را بزنید.",
    "با باز شدن اپلیکیشن در تلگرام، شناسه شما به‌صورت امن تأیید و حساب بازی بارگذاری می‌شود.",
    "",
    "اگر می‌خواهید نسخه نصب‌شده را اجرا کنید، ابتدا PWA را نصب کنید و سپس از همین ربات دکمه ورود به بازی را بزنید.",
    "",
    "🏆 آماده ورود به میدان هستید؟"
  ].join("\\n");

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
