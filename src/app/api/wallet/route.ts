import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDepositConfiguration } from "@/lib/deposit-proof";
import { convertUsdtToGmoBaseUnits } from "@/lib/wallet-exchange-rate";
import { hasAdminPermission } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const prisma = getPrisma();
    const authenticatedUserId = await getAuthenticatedUser();
    const demoUser = !authenticatedUserId && process.env.NODE_ENV !== "production" && url.searchParams.get("demo") === "1"
      ? await prisma.user.findUnique({ where: { username: "wallet-demo" }, select: { id: true } })
      : null;
    const userId = authenticatedUserId ?? demoUser?.id ?? null;
    if (!userId) return NextResponse.json({ error: "برای دیدن کیف پول وارد حساب شو.", authRequired: true }, { status: 401 });

    const [accounts, pendingWithdrawals, activeReservations] = await Promise.all([
      prisma.walletAccount.findMany({
        where: { userId, currency: "GMO", isActive: true, accountType: { in: ["BALANCE", "REWARDS", "PRIZE"] } },
        select: {
          accountType: true,
          entries: { where: { transaction: { status: "COMPLETED" } }, select: { amount: true, direction: true } },
        },
      }),
      prisma.withdrawal.aggregate({ where: { userId, currency: "GMO", status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
      prisma.walletReservation.aggregate({ where: { userId, status: "RESERVED", account: { accountType: "BALANCE", currency: "GMO" } }, _sum: { amount: true } }),
    ]);
    const balances = Object.fromEntries(["BALANCE", "REWARDS", "PRIZE"].map((type) => {
      const account = accounts.find((row) => row.accountType === type);
      const balance = (account?.entries ?? []).reduce((sum, entry) => sum + (entry.direction === "CREDIT" ? entry.amount : -entry.amount), 0n);
      return [type, balance.toString()];
    }));
    const availableBalance = BigInt(balances.BALANCE ?? "0") - (pendingWithdrawals._sum.amount ?? 0n) - (activeReservations._sum.amount ?? 0n);
    return NextResponse.json({
      balances,
      availableBalance: availableBalance.toString(),
      demo: Boolean(demoUser),
      canManageWallet: await hasAdminPermission(userId, "wallet:manage"),
      deposit: { ...getDepositConfiguration(), exchangeRateConfigured: Boolean(convertUsdtToGmoBaseUnits(1_000_000n)) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "دریافت اطلاعات کیف پول ممکن نشد." }, { status: 503 });
  }
}
