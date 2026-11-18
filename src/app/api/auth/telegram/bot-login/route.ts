import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

type TelegramBotUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Called only by our Telegram webhook after Telegram has authenticated the sender.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret || request.headers.get("x-gmo-bot-login-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let telegram: TelegramBotUser;
  try {
    const body = await request.json() as TelegramBotUser;
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
    const prisma = getPrisma();
    const ticket = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const userId = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(${BigInt(telegram.id)})) AS advisory_lock`;
      const identity = await tx.externalAccount.upsert({
        where: { provider_providerUserId: { provider: "TELEGRAM", providerUserId: String(telegram.id) } },
        update: { metadata: { username: telegram.username ?? "", firstName: telegram.first_name } },
        create: {
          provider: "TELEGRAM",
          providerUserId: String(telegram.id),
          metadata: { username: telegram.username ?? "", firstName: telegram.first_name },
          user: {
            create: {
              username: `tg_${telegram.id}`,
              profile: { create: { displayName: [telegram.first_name, telegram.last_name].filter(Boolean).join(" ").slice(0, 64), preferredLocale: "fa" } },
            },
          },
        },
        select: { userId: true, user: { select: { status: true } } },
      });
      if (identity.user.status !== "ACTIVE") throw new Error("ACCOUNT_INACTIVE");

      const administrators = (process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map(id => id.trim());
      if (administrators.includes(String(telegram.id))) {
        const role = await tx.adminRole.upsert({
          where: { name: "WALLET_ADMIN" },
          update: { permissions: ["wallet:manage"] },
          create: { name: "WALLET_ADMIN", permissions: ["wallet:manage"] },
        });
        await tx.adminUser.upsert({
          where: { userId_roleId: { userId: identity.userId, roleId: role.id } },
          update: {},
          create: { userId: identity.userId, roleId: role.id },
        });
      } else {
        await tx.adminUser.deleteMany({ where: { userId: identity.userId, role: { name: "WALLET_ADMIN" } } });
      }

      for (const accountType of ["BALANCE", "REWARDS", "PRIZE"] as const) {
        await tx.walletAccount.upsert({
          where: { userId_accountType_currency: { userId: identity.userId, accountType, currency: "GMO" } },
          update: {},
          create: { userId: identity.userId, accountType, currency: "GMO" },
        });
      }

      await tx.session.deleteMany({ where: { userId: identity.userId, expiresAt: { lt: new Date() } } });
      await tx.session.create({
        data: { userId: identity.userId, tokenHash: hashToken(ticket), expiresAt },
      });
      return identity.userId;
    });

    const appUrl = process.env.APP_URL?.trim() || "https://gmo-arena.omidhub-ai.workers.dev";
    const loginUrl = new URL("/api/auth/telegram/bot-login", appUrl);
    loginUrl.searchParams.set("ticket", ticket);
    return NextResponse.json({ ok: true, loginUrl: loginUrl.toString(), userId });
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
  const ticketHash = hashToken(ticket);
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
      data: { tokenHash: hashToken(nextToken), expiresAt, lastSeenAt: new Date() },
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
