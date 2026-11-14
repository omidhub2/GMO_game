import type { PrismaClient } from "@prisma/client";

export type WalletDemoTransaction = { id: string; type: string; title: string; description: string; reference: string | null; amount: string; currency: string; direction: string; status: string; createdAt: string };

function ago(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function seedWalletDemo(prisma: PrismaClient) {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_WALLET_DEMO_DATA !== "true") return;
  const demoUser = await prisma.user.upsert({
    where: { username: "wallet-demo" },
    update: {},
    create: {
      username: "wallet-demo",
      walletAccounts: { create: [
        { accountType: "BALANCE", currency: "GMO" },
        { accountType: "REWARDS", currency: "GMO" },
        { accountType: "PRIZE", currency: "GMO" },
      ] },
    },
    select: { id: true },
  });
  const accounts = await prisma.walletAccount.findMany({ where: { userId: demoUser.id, currency: "GMO" }, select: { id: true, accountType: true } });
  const system = await prisma.walletAccount.findFirstOrThrow({ where: { userId: null, accountType: "SYSTEM", currency: "GMO" }, select: { id: true } });
  const accountByType = new Map(accounts.map((account) => [account.accountType, account.id]));
  const rows = [
    { key: "demo-credit-initial", type: "ADJUSTMENT" as const, title: "شارژ نمونه کیف پول", amount: 1_000_000_000n, typeAccount: "BALANCE" as const, direction: "CREDIT" as const, description: "اعتبار آزمایشی · محیط توسعه", days: 20 },
    { key: "demo-reward-initial", type: "MISSION_REWARD" as const, title: "پاداش نمونه", amount: 84_000_000n, typeAccount: "REWARDS" as const, direction: "CREDIT" as const, description: "شارژ آزمایشی پاداش‌ها", days: 19 },
    { key: "demo-prize-initial", type: "PRIZE" as const, title: "جوایز نمونه", amount: 235_000_000n, typeAccount: "PRIZE" as const, direction: "CREDIT" as const, description: "شارژ آزمایشی جوایز مسابقه", days: 18 },
    { key: "demo-deposit-01", type: "DEPOSIT" as const, title: "واریز نمونه USDT", amount: 25_000_000n, typeAccount: "BALANCE" as const, direction: "CREDIT" as const, description: "واریز نمونه · شبکه TRON", days: 7 },
    { key: "demo-tournament-01", type: "TOURNAMENT_ENTRY" as const, title: "ورودی تورنومنت", amount: 25_000_000n, typeAccount: "BALANCE" as const, direction: "DEBIT" as const, description: "جام هفتگی VALORANT · نمونه", days: 6 },
    { key: "demo-reward-01", type: "MISSION_REWARD" as const, title: "پاداش مأموریت", amount: 10_000_000n, typeAccount: "REWARDS" as const, direction: "CREDIT" as const, description: "تکمیل مأموریت روزانه · نمونه", days: 5 },
    { key: "demo-prize-01", type: "PRIZE" as const, title: "جایزه مسابقه", amount: 50_000_000n, typeAccount: "PRIZE" as const, direction: "CREDIT" as const, description: "مقام اول مسابقه · نمونه", days: 4 },
    { key: "demo-withdrawal-01", type: "WITHDRAWAL" as const, title: "درخواست برداشت", amount: 15_000_000n, typeAccount: "BALANCE" as const, direction: "DEBIT" as const, description: "درخواست برداشت آزمایشی", days: 3 },
    { key: "demo-refund-01", type: "TOURNAMENT_REFUND" as const, title: "بازپرداخت ورودی", amount: 25_000_000n, typeAccount: "BALANCE" as const, direction: "CREDIT" as const, description: "بازپرداخت تورنومنت لغوشده · نمونه", days: 2 },
    { key: "demo-prediction-01", type: "TRANSFER" as const, title: "هزینه پیش‌بینی", amount: 5_000_000n, typeAccount: "BALANCE" as const, direction: "DEBIT" as const, description: "پیش‌بینی ورزشی · نمونه", days: 1 },
    { key: "demo-reward-02", type: "REFERRAL_REWARD" as const, title: "پاداش دعوت دوستان", amount: 5_000_000n, typeAccount: "REWARDS" as const, direction: "CREDIT" as const, description: "دعوت موفق دوست · نمونه", days: 10 },
    { key: "demo-prize-02", type: "PRIZE" as const, title: "جایزهٔ رقابت", amount: 12_000_000n, typeAccount: "PRIZE" as const, direction: "CREDIT" as const, description: "مقام سوم رقابت هفتگی · نمونه", days: 12 },
    { key: "demo-deposit-02", type: "DEPOSIT" as const, title: "شارژ کیف پول", amount: 8_000_000n, typeAccount: "BALANCE" as const, direction: "CREDIT" as const, description: "شارژ نمونهٔ اعتبار · TRON", days: 14 },
  ];

  for (const row of rows) {
    const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: row.key }, select: { id: true } });
    if (existing) continue;
    const accountId = accountByType.get(row.typeAccount);
    if (!accountId) continue;
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.ledgerTransaction.create({ data: { reference: row.key, idempotencyKey: row.key, type: row.type, status: "COMPLETED", description: row.description, actorId: demoUser.id, createdAt: ago(row.days), metadata: { demo: true, sample: true } }, select: { id: true } });
      await tx.ledgerEntry.createMany({ data: [
        { transactionId: transaction.id, accountId: row.direction === "CREDIT" ? accountId : system.id, amount: row.amount, direction: row.direction },
        { transactionId: transaction.id, accountId: row.direction === "CREDIT" ? system.id : accountId, amount: row.amount, direction: row.direction === "CREDIT" ? "DEBIT" : "CREDIT" },
      ] });
    });
  }
}

export async function getWalletDemoTransactions(prisma: PrismaClient, userId: string, filters: { type: string; status: string; from: string | null; to: string | null }) {
  const accountRows = await prisma.walletAccount.findMany({
    where: { userId, currency: "GMO", isActive: true, accountType: { in: ["BALANCE", "REWARDS", "PRIZE"] } },
    select: {
      entries: {
        select: {
          id: true, amount: true, direction: true, createdAt: true,
          transaction: { select: { status: true, type: true, description: true, reference: true } },
        },
      },
    },
  });
  const names: Record<string, string> = { ADJUSTMENT: "شارژ نمونهٔ اعتبار", MISSION_REWARD: "پاداش نمونه", PRIZE: "جایزهٔ نمونه", DEPOSIT: "واریز نمونه", TOURNAMENT_ENTRY: "ورودی تورنومنت", TOURNAMENT_REFUND: "بازپرداخت تورنومنت", WITHDRAWAL: "برداشت نمونه", TRANSFER: "هزینهٔ پیش‌بینی" };
  return accountRows.flatMap((account) => account.entries.map((entry) => ({ id: entry.id, type: entry.transaction.type, title: names[entry.transaction.type] ?? entry.transaction.description, description: entry.transaction.description, reference: entry.transaction.reference, amount: entry.amount.toString(), currency: "GMO", direction: entry.direction, status: entry.transaction.status, createdAt: entry.createdAt.toISOString() } satisfies WalletDemoTransaction))).filter((item) => {
    if (filters.type !== "ALL" && item.type !== filters.type && !(filters.type === "REWARD" && item.type.endsWith("_REWARD"))) return false;
    if (filters.status !== "ALL" && item.status !== filters.status) return false;
    const date = new Date(item.createdAt);
    if (filters.from && date < new Date(`${filters.from}T00:00:00.000Z`)) return false;
    if (filters.to && date > new Date(`${filters.to}T23:59:59.999Z`)) return false;
    return true;
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
