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
    "برای تجربه بهتر، بازی را به صفحه اصلی گوشی‌تان اضافه کنید تا مثل یک اپلیکیشن مستقل و تمام‌صفحه در دسترس باشد.",
    "",
    "۱) ابتدا دکمه «ورود به GMO Arena» را بزنید.",
    "۲) پس از باز شدن بازی، گزینه «نصب GMO Arena» را انتخاب کنید.",
    "۳) در پنجره بازشده، «افزودن به صفحه اصلی» یا «Install» را تأیید کنید.",
    "",
    "📱 اگر گزینه نصب نمایش داده نشد، از منوی تلگرام یا مرورگر گوشی گزینه Add to Home Screen را انتخاب کنید.",
    "",
    "🚀 آماده‌اید؟ وارد میدان شوید!"
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: welcome,
        reply_markup: {
          inline_keyboard: [[{ text: "🎮 ورود به GMO Arena", web_app: { url: appUrl } }]]
        }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) console.error("[telegram-webhook] sendMessage failed", response.status);
  } catch (error) {
    console.error("[telegram-webhook] Telegram API request failed", error instanceof Error ? error.name : "UnknownError");
  }

  return NextResponse.json({ ok: true });
}
