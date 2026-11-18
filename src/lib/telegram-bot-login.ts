import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";

export type TelegramBotIdentity = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

export function hashTelegramSessionToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createTelegramPwaLoginTicket(telegram: TelegramBotIdentity) {
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
      data: { userId: identity.userId, tokenHash: hashTelegramSessionToken(ticket), expiresAt },
    });
    return identity.userId;
  });

  const appUrl = process.env.APP_URL?.trim() || "https://gmo-arena.omidhub-ai.workers.dev";
  const loginUrl = new URL("/api/auth/telegram/bot-login", appUrl);
  loginUrl.searchParams.set("ticket", ticket);
  return { userId, ticket, loginUrl: loginUrl.toString() };
}
