import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { validateTelegramInitData } from "@/lib/telegram-auth";

export const runtime = "nodejs";

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: "A non-Error value was thrown." };
  }

  const candidate = error as Error & { code?: unknown; cause?: unknown };
  const rawMessage = candidate.message || "No error message";
  const message = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s"'\])}]+/gi, "[DATABASE_URL_REDACTED]")
    .replace(/(password|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 400);

  return {
    name: candidate.name.slice(0, 100),
    message,
    ...(typeof candidate.code === "string" || typeof candidate.code === "number"
      ? { code: String(candidate.code).slice(0, 40) }
      : {}),
    ...(candidate.cause instanceof Error
      ? { causeName: candidate.cause.name.slice(0, 100) }
      : {}),
  };
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return NextResponse.json({ error: "Telegram sign-in is not configured." }, { status: 503 });

  let telegram;
  try {
    const body = await request.json();
    if (typeof body.initData !== "string") throw new Error("INVALID_TELEGRAM_DATA");
    const configuredAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 3600);
    const maxAge = Number.isSafeInteger(configuredAge) && configuredAge > 0 ? configuredAge : 3600;
    telegram = validateTelegramInitData(body.initData, botToken, maxAge);
  } catch {
    return NextResponse.json({ error: "Telegram sign-in expired or is invalid. Reopen the app from Telegram." }, { status: 401 });
  }

  let stage = "create_session_token";
  try {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    stage = "database_transaction";
    const userId = await getPrisma().$transaction(async tx => {
      // Keep first sign-ins for the same Telegram identity serialized. Return an
      // integer from the outer SELECT because PostgreSQL's advisory-lock function
      // returns void, which Prisma's raw-query decoder cannot deserialize.
      stage = "lock_telegram_identity";
      await tx.$queryRaw`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(${BigInt(telegram.id)})) AS advisory_lock`;

      stage = "upsert_external_account";
      const identity = await tx.externalAccount.upsert({
        where: { provider_providerUserId: { provider: "TELEGRAM", providerUserId: String(telegram.id) } },
        update: { metadata: { username: telegram.username ?? "", firstName: telegram.first_name } },
        create: {
          provider: "TELEGRAM", providerUserId: String(telegram.id),
          metadata: { username: telegram.username ?? "", firstName: telegram.first_name },
          user: { create: { username: `tg_${telegram.id}`, profile: { create: { displayName: [telegram.first_name, telegram.last_name].filter(Boolean).join(" ").slice(0, 64), preferredLocale: "en" } } } },
        },
        select: { userId: true, user: { select: { status: true } } },
      });

      if (identity.user.status !== "ACTIVE") throw new Error("ACCOUNT_INACTIVE");

      const administrators = (process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map(id => id.trim());
      if (administrators.includes(String(telegram.id))) {
        stage = "assign_admin_role";
        const role = await tx.adminRole.upsert({ where: { name: "WALLET_ADMIN" }, update: { permissions: ["wallet:manage"] }, create: { name: "WALLET_ADMIN", permissions: ["wallet:manage"] } });
        await tx.adminUser.upsert({ where: { userId_roleId: { userId: identity.userId, roleId: role.id } }, update: {}, create: { userId: identity.userId, roleId: role.id } });
      } else {
        stage = "remove_unconfigured_admin_role";
        await tx.adminUser.deleteMany({ where: { userId: identity.userId, role: { name: "WALLET_ADMIN" } } });
      }

      stage = "ensure_wallet_accounts";
      for (const accountType of ["BALANCE", "REWARDS", "PRIZE"] as const) {
        await tx.walletAccount.upsert({ where: { userId_accountType_currency: { userId: identity.userId, accountType, currency: "GMO" } }, update: {}, create: { userId: identity.userId, accountType, currency: "GMO" } });
      }

      stage = "remove_expired_sessions";
      await tx.session.deleteMany({ where: { userId: identity.userId, expiresAt: { lt: new Date() } } });

      stage = "create_database_session";
      await tx.session.create({ data: { userId: identity.userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt } });
      return identity.userId;
    });

    stage = "set_session_cookie";
    const response = NextResponse.json({ user: { id: userId }, authenticated: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("gmo_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json({ error: "This account is not active." }, { status: 403 });
    }

    console.error("[telegram-auth] sign-in provisioning failed", {
      stage,
      ...getSafeErrorDetails(error),
    });
    return NextResponse.json({ error: "Sign-in service is unavailable. Please try again." }, { status: 503 });
  }
}
