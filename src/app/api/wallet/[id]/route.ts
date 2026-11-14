import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const authenticatedUserId = await getAuthenticatedUser();
    const prisma = getPrisma();
    const demoUser = !authenticatedUserId && process.env.NODE_ENV !== "production" && new URL(_request.url).searchParams.get("demo") === "1"
      ? await prisma.user.findUnique({ where: { username: "wallet-demo" }, select: { id: true } })
      : null;
    const userId = authenticatedUserId ?? demoUser?.id ?? null;
    if (!userId) return NextResponse.json({ error: "برای دیدن جزئیات وارد حساب شو." }, { status: 401 });

    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: { id, account: { userId } },
      select: {
        id: true,
        amount: true,
        direction: true,
        createdAt: true,
        account: { select: { currency: true, accountType: true } },
        transaction: { select: { id: true, type: true, status: true, description: true, reference: true, createdAt: true, metadata: true } },
      },
    });
    if (ledgerEntry) {
      const previewDebit = demoUser && ["TOURNAMENT_ENTRY", "TRANSFER", "WITHDRAWAL"].includes(ledgerEntry.transaction.type) && ledgerEntry.transaction.reference.startsWith("local-wallet-preview-");
      return NextResponse.json({ data: { id: ledgerEntry.transaction.id, entryId: ledgerEntry.id, type: ledgerEntry.transaction.type, title: ledgerEntry.transaction.description, description: ledgerEntry.transaction.description, reference: ledgerEntry.transaction.reference, amount: ledgerEntry.amount.toString(), currency: ledgerEntry.account.currency, accountType: ledgerEntry.account.accountType, direction: previewDebit ? "DEBIT" : ledgerEntry.direction, status: ledgerEntry.transaction.status, createdAt: ledgerEntry.transaction.createdAt.toISOString(), metadata: ledgerEntry.transaction.metadata } });
    }

    const [deposit, withdrawal, reward, prediction] = await Promise.all([
      prisma.deposit.findFirst({ where: { id, userId }, select: { id: true, amount: true, currency: true, externalReference: true, status: true, createdAt: true, provider: true } }),
      prisma.withdrawal.findFirst({ where: { id, userId }, select: { id: true, amount: true, currency: true, externalReference: true, status: true, createdAt: true, provider: true } }),
      prisma.reward.findFirst({ where: { id, userId }, select: { id: true, amount: true, rewardType: true, source: true, reference: true, status: true, createdAt: true } }),
      prisma.sportsPrediction.findFirst({ where: { id, userId }, select: { id: true, amount: true, status: true, placedAt: true, market: { select: { title: true } }, option: { select: { label: true } } } }),
    ]);
    if (deposit) return NextResponse.json({ data: { id: deposit.id, type: "DEPOSIT", title: "واریز", description: `درخواست واریز · ${deposit.provider}`, reference: deposit.externalReference, amount: deposit.amount.toString(), currency: deposit.currency, direction: "CREDIT", status: deposit.status, createdAt: deposit.createdAt.toISOString() } });
    if (withdrawal) return NextResponse.json({ data: { id: withdrawal.id, type: "WITHDRAWAL", title: "برداشت", description: `درخواست برداشت · ${withdrawal.provider}`, reference: withdrawal.externalReference, amount: withdrawal.amount.toString(), currency: withdrawal.currency, direction: "DEBIT", status: withdrawal.status, createdAt: withdrawal.createdAt.toISOString() } });
    if (reward) return NextResponse.json({ data: { id: reward.id, type: "REWARD", title: reward.rewardType, description: reward.source, reference: reward.reference, amount: reward.amount.toString(), currency: "GMO", direction: "CREDIT", status: reward.status, createdAt: reward.createdAt.toISOString() } });
    if (prediction) return NextResponse.json({ data: { id: prediction.id, type: "PREDICTION", title: "پیش‌بینی ورزشی", description: `${prediction.market.title} · ${prediction.option.label}`, reference: prediction.id, amount: prediction.amount.toString(), currency: "GMO", direction: "DEBIT", status: prediction.status, createdAt: prediction.placedAt.toISOString() } });
    if (demoUser) {
      const ledgerDemo = await prisma.ledgerTransaction.findFirst({
        where: { actorId: userId, idempotencyKey: id, metadata: { path: ["demo"], equals: true } },
        select: {
          id: true, type: true, status: true, description: true, reference: true, createdAt: true,
          entries: {
            where: { account: { userId } },
            select: { amount: true, direction: true, account: { select: { currency: true, accountType: true } } },
            take: 1,
          },
        },
      });
      const demoEntry = ledgerDemo?.entries[0];
      if (ledgerDemo && demoEntry) return NextResponse.json({ data: { id: ledgerDemo.id, type: ledgerDemo.type, title: ledgerDemo.description, description: ledgerDemo.description, reference: ledgerDemo.reference, amount: demoEntry.amount.toString(), currency: demoEntry.account.currency, direction: demoEntry.direction, status: ledgerDemo.status, createdAt: ledgerDemo.createdAt.toISOString() }, demo: true });
    }
    return NextResponse.json({ error: "این تراکنش پیدا نشد." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "جزئیات تراکنش دریافت نشد." }, { status: 503 });
  }
}
