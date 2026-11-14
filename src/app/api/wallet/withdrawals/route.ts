import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { TronWeb } from "tronweb";
import { convertGmoToUsdtBaseUnits } from "@/lib/wallet-exchange-rate";

export const runtime = "nodejs";

function parseGmoAmount(value: unknown) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return units > 0n ? units : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "برای ثبت برداشت باید وارد حساب شوی." }, { status: 401 });
    const body = await request.json() as { amount?: unknown; address?: unknown };
    const amount = parseGmoAmount(body.amount);
    if (!amount) return NextResponse.json({ error: "مبلغ برداشت GMO معتبر وارد کن." }, { status: 400 });
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (!TronWeb.isAddress(address)) return NextResponse.json({ error: "آدرس مقصد ترون معتبر نیست." }, { status: 400 });

    const prisma = getPrisma();
    const key = request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return NextResponse.json({ error: "Invalid request key." }, { status: 400 });
    const payoutAmount = convertGmoToUsdtBaseUnits(amount);
    if (!payoutAmount) return NextResponse.json({ error: "Amount is below the payout precision or the exchange rate is unavailable." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.walletAccount.findFirst({ where: { userId, accountType: "BALANCE", currency: "GMO", isActive: true }, select: { id: true } });
      if (!account) throw new Error("WALLET_ACCOUNT_MISSING");
      await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;
      const requestKey = `${userId}:${key}`;
      const previous = await tx.withdrawal.findUnique({ where: { requestKey } });
      if (previous) {
        if (previous.amount !== amount || previous.externalReference !== address) throw new Error("KEY_CONFLICT");
        return { id: previous.id, amount: previous.amount, currency: previous.currency, status: previous.status, createdAt: previous.createdAt };
      }
      const entries = await tx.ledgerEntry.groupBy({ by: ["direction"], where: { accountId: account.id, transaction: { status: "COMPLETED" } }, _sum: { amount: true } });
      let available = 0n;
      for (const entry of entries) available += entry.direction === "CREDIT" ? entry._sum.amount ?? 0n : -(entry._sum.amount ?? 0n);
      const pending = await tx.withdrawal.aggregate({ where: { userId, currency: "GMO", status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } });
      const reserved = await tx.walletReservation.aggregate({ where: { accountId: account.id, status: "RESERVED" }, _sum: { amount: true } });
      available -= (pending._sum.amount ?? 0n) + (reserved._sum.amount ?? 0n);
      if (available < amount) throw new Error("INSUFFICIENT_FUNDS");
      return tx.withdrawal.create({ data: { userId, amount, payoutAmount, requestKey, currency: "GMO", provider: "TRON_MANUAL", externalReference: address }, select: { id: true, amount: true, currency: true, status: true, createdAt: true } });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ data: { ...result, amount: result.amount.toString() }, message: "درخواست برداشت ثبت شد و پس از بررسی پشتیبانی پردازش می‌شود." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "KEY_CONFLICT") return NextResponse.json({ error: "This request key was used for different withdrawal details." }, { status: 409 });
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "موجودی قابل برداشت کافی نیست؛ درخواست‌های در انتظار نیز از موجودی کسر شده‌اند." }, { status: 409 });
    if (error instanceof Error && error.message === "WALLET_ACCOUNT_MISSING") return NextResponse.json({ error: "حساب اعتبار کیف پول پیدا نشد." }, { status: 404 });
    const code = (error as { code?: string })?.code;
    if (code === "P2034") return NextResponse.json({ error: "درخواست هم‌زمانی انجام شد؛ دوباره تلاش کن." }, { status: 409 });
    return NextResponse.json({ error: "ثبت درخواست برداشت ممکن نشد." }, { status: 503 });
  }
}
