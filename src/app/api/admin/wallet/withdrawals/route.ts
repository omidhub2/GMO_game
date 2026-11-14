import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/admin-auth";
import { getPrisma } from "@/lib/db";
import { verifyTronUsdtDeposit } from "@/lib/tron-payment-verifier";
import { convertGmoToUsdtBaseUnits } from "@/lib/wallet-exchange-rate";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthenticatedUser();
  if (!userId || !await hasAdminPermission(userId, "wallet:manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const rows = await getPrisma().withdrawal.findMany({ where: { status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { createdAt: "asc" }, take: 100 });
  return NextResponse.json({ data: rows.map(row => ({ ...row, amount: row.amount.toString(), payoutAmount: row.payoutAmount?.toString() ?? null })) }, { headers: { "Cache-Control": "no-store" } });
}

const command = z.object({ id: z.string().uuid(), action: z.enum(["PROCESS", "REJECT", "COMPLETE"]), txHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional() });

export async function POST(request: Request) {
  try {
    const actorId = await getAuthenticatedUser();
    if (!actorId || !await hasAdminPermission(actorId, "wallet:manage")) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid withdrawal action." }, { status: 400 });
    const input = parsed.data;
    const prisma = getPrisma();
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: input.id } });
    if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    const payoutAmount = withdrawal.payoutAmount ?? convertGmoToUsdtBaseUnits(withdrawal.amount);
    if (input.action === "COMPLETE") {
      const sender = process.env.TRON_HOT_WALLET_ADDRESS?.trim();
      if (!input.txHash || !sender || !payoutAmount || !withdrawal.externalReference) return NextResponse.json({ error: "Payout address, amount and transaction ID are required." }, { status: 400 });
      const expectedAmount = `${payoutAmount / 1_000_000n}.${(payoutAmount % 1_000_000n).toString().padStart(6, "0")}`;
      const verified = await verifyTronUsdtDeposit({ txHash: input.txHash.toLowerCase(), expectedAmount, expectedSender: sender, destination: withdrawal.externalReference, minTimestamp: withdrawal.createdAt.getTime() });
      if (!verified.valid) return NextResponse.json({ error: "No confirmed payout matches this withdrawal." }, { status: 400 });
    }
    await prisma.$transaction(async tx => {
      const account = await tx.walletAccount.findUnique({ where: { userId_accountType_currency: { userId: withdrawal.userId, accountType: "BALANCE", currency: "GMO" } } });
      if (!account) throw new Error("WALLET_NOT_READY");
      await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;
      const current = await tx.withdrawal.findUniqueOrThrow({ where: { id: input.id } });
      if (current.status === "COMPLETED" && input.action === "COMPLETE" && current.payoutTxHash === input.txHash?.toLowerCase()) return;
      if (input.action === "REJECT" || input.action === "PROCESS") {
        if (current.status !== "PENDING") throw new Error("INVALID_STATE");
        if (input.action === "PROCESS" && !payoutAmount) throw new Error("WALLET_NOT_READY");
        await tx.withdrawal.update({ where: { id: input.id }, data: { status: input.action === "REJECT" ? "REJECTED" : "PROCESSING", payoutAmount, processedAt: input.action === "REJECT" ? new Date() : null } });
      } else {
        if (current.status !== "PROCESSING") throw new Error("INVALID_STATE");
        const system = await tx.walletAccount.findFirst({ where: { userId: null, accountType: "SYSTEM", currency: "GMO", isActive: true } });
        if (!system) throw new Error("WALLET_NOT_READY");
        const ledger = await tx.ledgerTransaction.create({ data: { reference: `withdrawal:${current.id}`, idempotencyKey: `withdrawal:${current.id}`, type: "WITHDRAWAL", description: "Confirmed USDT payout on TRON", actorId, metadata: { txHash: input.txHash!.toLowerCase(), destination: current.externalReference, payoutAmount: payoutAmount!.toString() } } });
        await tx.ledgerEntry.createMany({ data: [
          { transactionId: ledger.id, accountId: account.id, amount: current.amount, direction: "DEBIT" },
          { transactionId: ledger.id, accountId: system.id, amount: current.amount, direction: "CREDIT" },
        ] });
        await tx.withdrawal.update({ where: { id: input.id }, data: { status: "COMPLETED", transactionId: ledger.id, payoutTxHash: input.txHash!.toLowerCase(), processedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { actorId, action: `wallet.withdrawal.${input.action.toLowerCase()}`, resourceType: "withdrawal", resourceId: input.id, metadata: { txHash: input.txHash ?? null } } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "This payout transaction has already been used." }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_STATE") return NextResponse.json({ error: "The withdrawal status changed. Refresh before continuing." }, { status: 409 });
    return NextResponse.json({ error: "The withdrawal could not be updated." }, { status: 503 });
  }
}
