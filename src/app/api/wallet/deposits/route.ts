import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { isTronTransactionHash, TRON_DEPOSIT_PROVIDER } from "@/lib/deposit-proof";
import { verifyTronUsdtDeposit } from "@/lib/tron-payment-verifier";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "Sign in with Telegram first." }, { status: 401 });
    const body = await request.json();
    if (typeof body.txHash !== "string" || !isTronTransactionHash(body.txHash) || typeof body.intentId !== "string") return NextResponse.json({ error: "A deposit request and valid transaction ID are required." }, { status: 400 });
    const prisma = getPrisma();
    const intent = await prisma.depositIntent.findFirst({ where: { id: body.intentId, userId } });
    if (!intent) return NextResponse.json({ error: "Deposit request not found." }, { status: 404 });
    const txHash = body.txHash.toLowerCase();
    if (intent.txHash) return NextResponse.json({ error: "This deposit request has already been credited." }, { status: 409 });
    const amount = `${intent.expectedAmount / 1_000_000n}.${(intent.expectedAmount % 1_000_000n).toString().padStart(6, "0")}`;
    const verified = await verifyTronUsdtDeposit({ txHash, expectedAmount: amount, destination: intent.address, minTimestamp: intent.createdAt.getTime(), maxTimestamp: intent.expiresAt.getTime() });
    if (!verified.valid) return NextResponse.json({ error: "No confirmed USDT transfer matches the exact amount, address and payment window of this request." }, { status: 400 });
    const id = crypto.randomUUID();
    await prisma.$transaction(async tx => {
      const claimed = await tx.depositIntent.updateMany({ where: { id: intent.id, userId, txHash: null }, data: { txHash } });
      if (claimed.count !== 1) throw new Error("ALREADY_CREDITED");
      const wallet = await tx.walletAccount.findUnique({ where: { userId_accountType_currency: { userId, accountType: "BALANCE", currency: "GMO" } } });
      const system = await tx.walletAccount.findFirst({ where: { userId: null, accountType: "SYSTEM", currency: "GMO", isActive: true } });
      if (!wallet?.isActive || !system) throw new Error("WALLET_NOT_READY");
      const ledger = await tx.ledgerTransaction.create({ data: { reference: `deposit:${txHash}`, idempotencyKey: `deposit:${txHash}`, type: "DEPOSIT", status: "COMPLETED", description: `USDT deposit on TRON`, actorId: userId, metadata: { txHash, intentId: intent.id, usdtBaseUnits: intent.expectedAmount.toString(), blockNumber: verified.blockNumber } } });
      await tx.ledgerEntry.createMany({ data: [
        { transactionId: ledger.id, accountId: system.id, amount: intent.gmoAmount, direction: "DEBIT" },
        { transactionId: ledger.id, accountId: wallet.id, amount: intent.gmoAmount, direction: "CREDIT" },
      ] });
      await tx.deposit.create({ data: { id, userId, transactionId: ledger.id, amount: intent.gmoAmount, currency: "GMO", provider: TRON_DEPOSIT_PROVIDER, externalReference: txHash, status: "COMPLETED", verifiedAt: new Date() } });
    });
    return NextResponse.json({ data: { id, status: "COMPLETED", creditedAmount: intent.gmoAmount.toString() } }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002" || (error instanceof Error && error.message === "ALREADY_CREDITED")) return NextResponse.json({ error: "This transfer has already been credited." }, { status: 409 });
    return NextResponse.json({ error: "The deposit could not be verified. Check history and retry when the network is available." }, { status: 503 });
  }
}
