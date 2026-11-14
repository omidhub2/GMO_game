import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: "برای تسویه باید وارد حساب مدیریتی شوی." }, { status: 401 });
  try {
    if (!await hasAdminPermission(userId, "predictions:settle")) return NextResponse.json({ error: "دسترسی تسویهٔ بازار نداری." }, { status: 403 });
    const { id: marketId } = await params;
    const body = await request.json() as { winningOptionId?: unknown; void?: unknown };
    const isVoid = body.void === true;
    if (!isVoid && typeof body.winningOptionId !== "string") return NextResponse.json({ error: "گزینهٔ برنده معتبر نیست." }, { status: 400 });

    const result = await getPrisma().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM prediction_markets WHERE id = ${marketId}::uuid FOR UPDATE`;
      const market = await tx.predictionMarket.findUnique({
        where: { id: marketId },
        select: { id: true, title: true, status: true, isDemo: true, options: { select: { id: true } } },
      });
      if (!market || market.isDemo) throw new Error("MARKET_UNAVAILABLE");
      if (market.status === "SETTLED" || market.status === "VOIDED") throw new Error("ALREADY_SETTLED");
      if (!isVoid && (!market.options.some((option) => option.id === body.winningOptionId) || market.status !== "LOCKED")) throw new Error("MARKET_NOT_LOCKED_OR_INVALID_WINNER");
      if (isVoid && !["OPEN", "LOCKED"].includes(market.status)) throw new Error("MARKET_CANNOT_VOID");
      if (!isVoid) await tx.predictionMarket.update({ where: { id: marketId }, data: { status: "SETTLED", winningOptionId: body.winningOptionId as string, settledAt: new Date() } });
      else await tx.predictionMarket.update({ where: { id: marketId }, data: { status: "VOIDED", settledAt: new Date() } });

      const predictions = await tx.sportsPrediction.findMany({ where: { marketId, status: "ACTIVE" }, select: { id: true, userId: true, amount: true, potentialPayout: true, optionId: true } });
      const system = await tx.walletAccount.findFirst({ where: { userId: null, accountType: "SYSTEM", currency: "GMO", isActive: true }, select: { id: true } });
      if (predictions.length && !system) throw new Error("SYSTEM_ACCOUNT_MISSING");
      const balancesByUser = new Map<string, string>();
      let totalSystemPayout = 0n;
      for (const prediction of predictions) {
        if (isVoid || prediction.optionId === body.winningOptionId) totalSystemPayout += isVoid ? prediction.amount : prediction.potentialPayout;
      }
      if (system && totalSystemPayout > 0n) {
        await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${system.id}::uuid FOR UPDATE`;
        const systemEntries = await tx.ledgerEntry.groupBy({ by: ["direction"], where: { accountId: system.id, transaction: { status: "COMPLETED" } }, _sum: { amount: true } });
        let treasury = 0n;
        for (const entry of systemEntries) {
          const amount = BigInt(entry._sum.amount ?? 0);
          treasury += entry.direction === "CREDIT" ? amount : -amount;
        }
        if (treasury < totalSystemPayout) throw new Error("TREASURY_INSUFFICIENT");
      }

      for (const prediction of predictions) {
        const winner = !isVoid && prediction.optionId === body.winningOptionId;
        const payout = isVoid ? prediction.amount : winner ? prediction.potentialPayout : 0n;
        const status = isVoid ? "VOIDED" : winner ? "CORRECT" : "INCORRECT";
        if (payout > 0n && system) {
          const account = await tx.walletAccount.findFirst({ where: { userId: prediction.userId, accountType: "BALANCE", currency: "GMO", isActive: true }, select: { id: true } });
          if (!account) throw new Error("WALLET_ACCOUNT_MISSING");
          await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;
          const key = `sports-settlement:${prediction.id}`;
          const ledger = await tx.ledgerTransaction.create({ data: { reference: key, idempotencyKey: key, type: isVoid ? "REVERSAL" : "PRIZE", status: "COMPLETED", description: isVoid ? `بازپرداخت بازار: ${market.title}` : `پرداخت پیش‌بینی برنده: ${market.title}`, actorId: userId, metadata: { marketId, predictionId: prediction.id, kind: isVoid ? "SPORTS_PREDICTION_REFUND" : "SPORTS_PREDICTION_PAYOUT" } }, select: { id: true } });
          await tx.ledgerEntry.createMany({
            data: [
              { transactionId: ledger.id, accountId: system.id, amount: payout, direction: "DEBIT" },
              { transactionId: ledger.id, accountId: account.id, amount: payout, direction: "CREDIT" },
            ]
          });
          balancesByUser.set(prediction.userId, (BigInt(balancesByUser.get(prediction.userId) ?? "0") + payout).toString());
        }
        await tx.sportsPrediction.update({ where: { id: prediction.id }, data: { status, settledAt: new Date() } });
      }
      await tx.predictionMarket.update({ where: { id: marketId }, data: { status: isVoid ? "VOIDED" : "SETTLED", winningOptionId: isVoid ? null : body.winningOptionId as string, settledAt: new Date() } });
      return { settled: predictions.length, paidOut: totalSystemPayout.toString(), balancesByUser: Object.fromEntries(balancesByUser) };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: result, message: "بازار تسویه و پرداخت‌ها در دفترکل ثبت شد." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = (error as { code?: string })?.code;
    if (message === "MARKET_UNAVAILABLE") return NextResponse.json({ error: "بازار واقعی پیدا نشد." }, { status: 404 });
    if (message === "ALREADY_SETTLED") return NextResponse.json({ error: "این بازار قبلاً تسویه شده است." }, { status: 409 });
    if (message === "MARKET_NOT_LOCKED_OR_INVALID_WINNER") return NextResponse.json({ error: "بازار باید قفل شده باشد و گزینهٔ برنده به همان بازار تعلق داشته باشد." }, { status: 409 });
    if (message === "MARKET_CANNOT_VOID") return NextResponse.json({ error: "این بازار در وضعیت فعلی قابل ابطال نیست." }, { status: 409 });
    if (message === "TREASURY_INSUFFICIENT") return NextResponse.json({ error: "موجودی خزانه برای پرداخت این تسویه کافی نیست؛ هیچ تغییری ثبت نشد." }, { status: 409 });
    if (message === "SYSTEM_ACCOUNT_MISSING" || message === "WALLET_ACCOUNT_MISSING") return NextResponse.json({ error: "حساب‌های دفترکل برای تسویه آماده نیستند." }, { status: 503 });
    if (code === "P2034") return NextResponse.json({ error: "تسویهٔ هم‌زمان رخ داد؛ دوباره بررسی کن." }, { status: 409 });
    return NextResponse.json({ error: "تسویهٔ بازار انجام نشد." }, { status: 503 });
  }
}
