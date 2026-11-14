import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { TRON_DEPOSIT_PROVIDER } from "@/lib/deposit-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REJECTED";
type HistoryType = "ALL" | "DEPOSIT" | "WITHDRAWAL" | "TOURNAMENT_ENTRY" | "TOURNAMENT_REFUND" | "PRIZE" | "REWARD" | "TRANSFER" | "ADJUSTMENT" | "PREDICTION";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const prisma = getPrisma();
    const authenticatedUserId = await getAuthenticatedUser();
    const demoUser = !authenticatedUserId && process.env.NODE_ENV !== "production" && url.searchParams.get("demo") === "1"
      ? await prisma.user.findUnique({ where: { username: "wallet-demo" }, select: { id: true } })
      : null;
    const userId = authenticatedUserId ?? demoUser?.id ?? null;
    if (!userId) return NextResponse.json({ error: "برای دیدن تاریخچه وارد حساب شو." }, { status: 401 });

    const requestedType = url.searchParams.get("type") ?? "ALL";
    const requestedStatus = url.searchParams.get("status") ?? "ALL";
    const allowedTypes = ["ALL", "DEPOSIT", "WITHDRAWAL", "TOURNAMENT_ENTRY", "TOURNAMENT_REFUND", "PRIZE", "REWARD", "TRANSFER", "ADJUSTMENT", "PREDICTION"];
    const allowedStatuses = ["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REJECTED"];
    const type = (allowedTypes.includes(requestedType) ? requestedType : "ALL") as HistoryType;
    const status = allowedStatuses.includes(requestedStatus) ? requestedStatus : "ALL";
    const predictionStatus = status === "ALL" || status === "COMPLETED" ? null : status === "PENDING" || status === "PROCESSING" ? "ACTIVE" as const : status === "CANCELLED" ? "VOIDED" as const : "INCORRECT" as const;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const validFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;
    const validTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null;
    const dateFilter = { ...(validFrom ? { gte: new Date(`${validFrom}T00:00:00.000Z`) } : {}), ...(validTo ? { lte: new Date(`${validTo}T23:59:59.999Z`) } : {}) };
    const hasDate = Boolean(validFrom || validTo);
    const paymentStatus = status === "ALL" ? undefined : status as PaymentStatus;

    const accountRows = await prisma.walletAccount.findMany({
      where: { userId, currency: "GMO", isActive: true, accountType: { in: ["BALANCE", "REWARDS", "PRIZE"] } },
      select: {
        entries: {
          where: { ...(hasDate ? { createdAt: dateFilter } : {}) },
          select: {
            id: true, amount: true, direction: true, createdAt: true,
            transaction: { select: { id: true, status: true, type: true, description: true, reference: true } },
          },
        },
      },
    });
    const [deposits, withdrawals, rewards, predictions] = await Promise.all([
      prisma.deposit.findMany({ where: { userId, ...(hasDate ? { createdAt: dateFilter } : {}), ...(paymentStatus ? { status: paymentStatus } : {}) }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, transactionId: true, amount: true, currency: true, externalReference: true, provider: true, status: true, createdAt: true } }),
      prisma.withdrawal.findMany({ where: { userId, ...(hasDate ? { createdAt: dateFilter } : {}), ...(paymentStatus ? { status: paymentStatus } : {}) }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, transactionId: true, amount: true, currency: true, externalReference: true, provider: true, status: true, createdAt: true } }),
      prisma.reward.findMany({ where: { userId, ...(hasDate ? { createdAt: dateFilter } : {}), ...(paymentStatus ? { status: paymentStatus } : {}) }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, transactionId: true, amount: true, rewardType: true, source: true, status: true, createdAt: true } }),
      prisma.sportsPrediction.findMany({ where: { userId, ...(hasDate ? { placedAt: dateFilter } : {}), ...(predictionStatus ? { status: predictionStatus } : {}) }, orderBy: { placedAt: "desc" }, take: 500, select: { id: true, amount: true, status: true, placedAt: true, market: { select: { title: true } }, option: { select: { label: true } } } }),
    ]);

    const labels: Record<string, string> = { DEPOSIT: "واریز", WITHDRAWAL: "برداشت", TRANSFER: "انتقال", TOURNAMENT_ENTRY: "ورودی تورنومنت", TOURNAMENT_REFUND: "بازپرداخت تورنومنت", PRIZE: "جایزه مسابقه", MISSION_REWARD: "پاداش مأموریت", REFERRAL_REWARD: "پاداش دعوت", REVERSAL: "برگشت تراکنش", ADJUSTMENT: "اصلاح موجودی", PREDICTION: "پیش‌بینی ورزشی" };
    const requestTransactionIds = new Set([...deposits, ...withdrawals, ...rewards].map((item) => item.transactionId).filter((value): value is string => Boolean(value)));
    const localPreviewDebitReferences = new Set(["local-wallet-preview-tournament-01", "local-wallet-preview-prediction-01", "local-wallet-preview-withdrawal-01"]);
    const entries = accountRows.flatMap((account) => account.entries.filter((entry) => entry.transaction.status === "COMPLETED" && !requestTransactionIds.has(entry.transaction.id) && !entry.transaction.reference?.startsWith("local-wallet-preview-correction-")).map((entry) => ({ id: entry.id, type: entry.transaction.type, title: labels[entry.transaction.type] ?? entry.transaction.description, description: entry.transaction.description, reference: entry.transaction.reference, amount: entry.amount.toString(), currency: "GMO", direction: localPreviewDebitReferences.has(entry.transaction.reference ?? "") ? "DEBIT" : entry.direction, status: "COMPLETED", createdAt: entry.createdAt.toISOString() })));
    const requests = [
      ...deposits.map((item) => ({ id: item.id, type: "DEPOSIT", title: item.provider === TRON_DEPOSIT_PROVIDER ? "واریز USDT" : "واریز", description: "درخواست واریز", reference: item.externalReference, amount: item.amount.toString(), currency: item.currency, direction: "CREDIT", status: item.status, createdAt: item.createdAt.toISOString() })),
      ...withdrawals.map((item) => ({ id: item.id, type: "WITHDRAWAL", title: "برداشت", description: "درخواست برداشت", reference: item.externalReference, amount: item.amount.toString(), currency: item.currency, direction: "DEBIT", status: item.status, createdAt: item.createdAt.toISOString() })),
      ...rewards.map((item) => ({ id: item.id, type: "REWARD", title: item.rewardType, description: item.source, reference: null, amount: item.amount.toString(), currency: "GMO", direction: "CREDIT", status: item.status, createdAt: item.createdAt.toISOString() })),
      ...predictions.map((item) => ({ id: item.id, type: "PREDICTION", title: labels.PREDICTION, description: `${item.market.title} · ${item.option.label}`, reference: null, amount: item.amount.toString(), currency: "GMO", direction: "DEBIT", status: item.status === "VOIDED" ? "REVERSED" : "COMPLETED", createdAt: item.placedAt.toISOString() })),
    ];
    const history = [...entries, ...requests].filter((item) => {
      const itemType = item.type as HistoryType;
      if (type !== "ALL" && itemType !== type && !(type === "REWARD" && itemType.endsWith("_REWARD"))) return false;
      if (status !== "ALL" && item.status !== status && !(itemType === "PREDICTION" && status === "COMPLETED" && item.status === "REVERSED")) return false;
      const date = new Date(item.createdAt);
      return (!validFrom || date >= new Date(`${validFrom}T00:00:00.000Z`)) && (!validTo || date <= new Date(`${validTo}T23:59:59.999Z`));
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 500);
    return NextResponse.json({ history, demo: Boolean(demoUser) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "دریافت تاریخچه تراکنش‌ها ممکن نشد." }, { status: 503 });
  }
}
