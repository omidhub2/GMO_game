import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createTelegramPwaLoginTicket, hashTelegramSessionToken, type TelegramBotIdentity } from "@/lib/telegram-bot-login";

export const runtime = "nodejs";

// Internal authenticated endpoint retained for diagnostics and trusted callers.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret || request.headers.get("x-gmo-bot-login-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let telegram: TelegramBotIdentity;
  try {
    const body = await request.json() as TelegramBotIdentity;
    if (!Number.isSafeInteger(body.id) || body.id <= 0 ||
        typeof body.first_name !== "string" || !body.first_name.trim() ||
        body.first_name.length > 256 ||
        (body.last_name !== undefined && (typeof body.last_name !== "string" || body.last_name.length > 256)) ||
        (body.username !== undefined && (typeof body.username !== "string" || body.username.length > 64))) {
      throw new Error("INVALID_TELEGRAM_USER");
    }
    telegram = body;
  } catch {
    return NextResponse.json({ error: "Invalid Telegram user" }, { status: 400 });
  }

  try {
    const result = await createTelegramPwaLoginTicket(telegram);
    return NextResponse.json({ ok: true, loginUrl: result.loginUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }
    console.error("[telegram-bot-login] ticket creation failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Could not prepare login" }, { status: 503 });
  }
}

// The short-lived URL ticket is exchanged once for a normal httpOnly PWA session.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket") ?? "";
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(ticket)) {
    return NextResponse.redirect(new URL("/?login=invalid", url.origin), 303);
  }

  const prisma = getPrisma();
  const ticketHash = hashTelegramSessionToken(ticket);
  const nextToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: ticketHash },
      select: { id: true, user: { select: { status: true } } },
    });
    if (!session || session.user.status !== "ACTIVE") {
      return NextResponse.redirect(new URL("/?login=expired", url.origin), 303);
    }

    const exchanged = await prisma.session.updateMany({
      where: { id: session.id, tokenHash: ticketHash, expiresAt: { gt: new Date() } },
      data: { tokenHash: hashTelegramSessionToken(nextToken), expiresAt, lastSeenAt: new Date() },
    });
    if (exchanged.count !== 1) {
      return NextResponse.redirect(new URL("/?login=expired", url.origin), 303);
    }

    const response = NextResponse.redirect(new URL("/?launch=pwa", url.origin), 303);
    response.cookies.set("gmo_session", nextToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("[telegram-bot-login] ticket exchange failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.redirect(new URL("/?login=unavailable", url.origin), 303);
  }
}
