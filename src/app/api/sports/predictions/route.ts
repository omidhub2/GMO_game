import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAmount(value: unknown) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return amount > 0n ? amount : null;
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: "برای ثبت پیش‌بینی باید وارد حساب شوی." }, { status: 401 });

  try {
    const body = await request.json() as { marketId?: unknown; optionId?: unknown; amount?: unknown; idempotencyKey?: unknown };
    if (typeof body.marketId !== "string" || typeof body.optionId !== "string") return NextResponse.json({ error: "بازار و گزینهٔ پیش‌بینی معتبر نیست." }, { status: 400 });
    const amount = parseAmount(body.amount);
    if (!amount) return NextResponse.json({ error: "مبلغ پیش‌بینی را به‌صورت GMO معتبر وارد کن." }, { status: 400 });
    const idempotencyKey = typeof body.idempotencyKey === "string" && /^[\w:-]{8,128}$/.test(body.idempotencyKey) ? body.idempotencyKey : randomUUID();
    const prisma = getPrisma();

    const result = await prisma.$transaction(async (tx) => {
      const market = await tx.predictionMarket.findUnique({
        where: { id: body.marketId as string },
        select: {
          id: true, title: true, status: true, isDemo: true, lockAt: true,
          fixture: {
            select: {
              event: { select: { isDemo: true, status: true } },
            },
          },
          options: { where: { id: body.optionId as string }, select: { id: true, label: true } },
        },
      });
      if (!market || !market.options.length) throw new Error("MARKET_NOT_FOUND");
      if (market.isDemo || market.fixture.event.isDemo) throw new Error("DEMO_MARKET");
      if (market.fixture.event.status === "CANCELLED" || market.status !== "OPEN" || market.lockAt <= new Date()) throw new Error("MARKET_CLOSED");
      const prior = await tx.sportsPrediction.findUnique({ where: { idempotencyKey }, select: { id: true, userId: true, amount: true, status: true } });
      if (prior) {
        if (prior.userId !== userId) throw new Error("IDEMPOTENCY_CONFLICT");
        return { ...prior, duplicate: true };
      }
      const alreadyEntered = await tx.sportsPrediction.findFirst({ where: { userId, marketId: market.id, status: { in: ["ACTIVE", "CORRECT"] } }, select: { id: true } });
      if (alreadyEntered) throw new Error("ALREADY_PREDICTED");

      const account = await tx.walletAccount.findFirst({ where: { userId, accountType: "BALANCE", currency: "GMO", isActive: true }, select: { id: true } });
      const system = await tx.walletAccount.findFirst({ where: { userId: null, accountType: "SYSTEM", currency: "GMO", isActive: true }, select: { id: true } });
      if (!account || !system) throw new Error("WALLET_LEDGER_ACCOUNTS_MISSING");
      await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${system.id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;
      const entries = await tx.ledgerEntry.groupBy({ by: ["direction"], where: { accountId: account.id, transaction: { status: "COMPLETED" } }, _sum: { amount: true } });
      let available = 0n;
      for (const entry of entries) available += entry.direction === "CREDIT" ? entry._sum.amount ?? 0n : -(entry._sum.amount ?? 0n);
      const [pending, reserved] = await Promise.all([
        tx.withdrawal.aggregate({ where: { userId, currency: "GMO", status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
        tx.walletReservation.aggregate({ where: { userId, status: "RESERVED" }, _sum: { amount: true } }),
      ]);
      available -= (pending._sum.amount ?? 0n) + (reserved._sum.amount ?? 0n);
      if (available < amount) throw new Error("INSUFFICIENT_FUNDS");

      const predictionId = randomUUID();
      const ledgerKey = `sports-prediction:${idempotencyKey}`;
      const ledger = await tx.ledgerTransaction.create({ data: { reference: ledgerKey, idempotencyKey: ledgerKey, type: "TRANSFER", status: "COMPLETED", description: `هزینهٔ پیش‌بینی: ${market.title}`, actorId: userId, metadata: { kind: "SPORTS_PREDICTION", predictionId, marketId: market.id, optionId: body.optionId as string } }, select: { id: true } });
      await tx.ledgerEntry.createMany({
        data: [
          { transactionId: ledger.id, accountId: account.id, amount, direction: "DEBIT" },
          { transactionId: ledger.id, accountId: system.id, amount, direction: "CREDIT" },
        ]
      });
      const prediction = await tx.sportsPrediction.create({ data: { id: predictionId, userId, marketId: market.id, optionId: body.optionId as string, amount, potentialPayout: amount, idempotencyKey, status: "ACTIVE" }, select: { id: true, amount: true, status: true, placedAt: true } });
      return { ...prediction, duplicate: false };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ data: { ...result, amount: result.amount.toString() }, message: result.duplicate ? "این پیش‌بینی قبلاً ثبت شده است." : "پیش‌بینی ثبت و مبلغ از اعتبار کیف پول کسر شد." }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = (error as { code?: string })?.code;
    if (message === "MARKET_NOT_FOUND") return NextResponse.json({ error: "بازار یا گزینه پیدا نشد." }, { status: 404 });
    if (message === "DEMO_MARKET") return NextResponse.json({ error: "بازارهای نمایشی پرداخت واقعی نمی‌پذیرند." }, { status: 422 });
    if (message === "MARKET_CLOSED") return NextResponse.json({ error: "این بازار باز نیست یا مهلت پیش‌بینی تمام شده است." }, { status: 409 });
    if (message === "ALREADY_PREDICTED") return NextResponse.json({ error: "برای این بازار قبلاً پیش‌بینی فعالی ثبت کرده‌ای." }, { status: 409 });
    if (message === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "اعتبار قابل‌استفاده کافی نیست." }, { status: 409 });
    if (message === "WALLET_LEDGER_ACCOUNTS_MISSING") return NextResponse.json({ error: "حساب دفترکل برای پیش‌بینی آماده نیست." }, { status: 503 });
    if (message === "IDEMPOTENCY_CONFLICT" || code === "P2002") return NextResponse.json({ error: "کلید درخواست قبلاً برای عملیات دیگری استفاده شده است." }, { status: 409 });
    if (code === "P2034") return NextResponse.json({ error: "درخواست هم‌زمان بود؛ دوباره تلاش کن." }, { status: 409 });
    return NextResponse.json({ error: "ثبت پیش‌بینی ممکن نشد." }, { status: 503 });
  }
}
