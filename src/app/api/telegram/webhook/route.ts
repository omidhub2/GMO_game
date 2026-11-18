import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: {
      id?: number;
      is_bot?: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
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
  const command = message?.text?.trim() ?? "";
  const from = message?.from;
  // A PWA login button opens t.me/bot?start=login. Telegram delivers that as
  // "/start login"; users should never need to type a separate /login command.
  const loginCommand = /^\/(?:login(?:@\w+)?|start(?:@\w+)?\s+login)(?:\s|$)/i.test(command);
  const startCommand = /^\/start(?:@\w+)?(?:\s|$)/i.test(command);

  if (!chatId || from?.is_bot || (!loginCommand && !startCommand)) {
    return NextResponse.json({ ok: true });
  }

  const appUrl = process.env.APP_URL?.trim() || "https://gmo-arena.omidhub-ai.workers.dev";
  let loginUrl: string | undefined;

  // /login is a bot-chat command, not a Telegram Mini App launch. Create a
  // short-lived one-time session ticket so the button can open the installed
  // PWA directly without depending on Telegram WebApp initData.
  if (loginCommand) {
    if (!from?.id || !from.first_name) {
      return NextResponse.json({ ok: true });
    }
    try {
      const provision = await fetch(new URL("/api/auth/telegram/bot-login", appUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gmo-bot-login-secret": secret,
        },
        body: JSON.stringify({
          id: from.id,
          first_name: from.first_name,
          last_name: from.last_name,
          username: from.username,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const result = await provision.json() as { loginUrl?: string };
      if (!provision.ok || !result.loginUrl) {
        console.error("[telegram-webhook] could not create PWA login ticket", provision.status);
        return NextResponse.json({ ok: true });
      }
      loginUrl = result.loginUrl;
    } catch (error) {
      console.error("[telegram-webhook] PWA login ticket request failed", error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json({ ok: true });
    }
  }

  const welcome = loginCommand
    ? [
        "🎮 ورود مستقیم به GMO Arena",
        "",
        "حساب تلگرام شما با امنیت تأیید شد.",
        "دکمه زیر را بزنید تا مستقیماً وارد نسخه نصب‌شده GMO Arena شوید؛ این دکمه Mini App تلگرام را باز نمی‌کند.",
        "",
        "🏆 به میدان خوش آمدید!"
      ].join("\n")
    : [
        "🎮 به GMO Arena خوش آمدید!",
        "",
        "برای اجرای بازی داخل تلگرام، دکمه زیر را بزنید.",
        "برای ورود مستقیم به نسخه نصب‌شده، از داخل اپلیکیشن روی «ورود از طریق تلگرام» بزنید و گزینه شروع ربات را تأیید کنید.",
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
          inline_keyboard: [[
            loginCommand
              ? { text: "🚀 ورود مستقیم به اپلیکیشن GMO Arena", url: loginUrl }
              : { text: "🎮 اجرای بازی داخل تلگرام", web_app: { url: appUrl } }
          ]]
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
