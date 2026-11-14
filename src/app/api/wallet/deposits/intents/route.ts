import { NextResponse } from "next/server";
import { TronWeb } from "tronweb";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getDepositConfiguration } from "@/lib/deposit-proof";
import { convertUsdtToGmoBaseUnits } from "@/lib/wallet-exchange-rate";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "Sign in with Telegram first." }, { status: 401 });
    const intent = await getPrisma().depositIntent.findFirst({ where: { userId, txHash: null }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ data: intent ? { id: intent.id, address: intent.address, amount: `${intent.expectedAmount / 1_000_000n}.${(intent.expectedAmount % 1_000_000n).toString().padStart(6, "0")}`, expiresAt: intent.expiresAt.toISOString() } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Deposit request unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUser();
    if (!userId) return NextResponse.json({ error: "Sign in with Telegram first." }, { status: 401 });
    const config = getDepositConfiguration();
    if (!TronWeb.isAddress(config.address) || !TronWeb.isAddress(config.tokenContract) || !convertUsdtToGmoBaseUnits(1_000_000n)) return NextResponse.json({ error: "Deposits are not configured yet." }, { status: 503 });
    const body = await request.json();
    if (typeof body.amount !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(body.amount)) return NextResponse.json({ error: "Enter a valid USDT amount." }, { status: 400 });
    const [whole, fraction = ""] = body.amount.split(".");
    const requestedAmount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
    if (requestedAmount < 1_000_000n) return NextResponse.json({ error: "Minimum deposit is 1 USDT." }, { status: 400 });
    const intent = await getPrisma().$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(748261045)`;
      const previous = await tx.depositIntent.findFirst({ where: { userId, requestedAmount, address: config.address, txHash: null, expiresAt: { gt: new Date() } } });
      if (previous) return previous;
      const recent = await tx.depositIntent.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
      if (recent >= 10) throw new Error("RATE_LIMIT");
      const used = await tx.depositIntent.findMany({ where: { expectedAmount: { gte: requestedAmount, lt: requestedAmount + 10_000n } }, select: { expectedAmount: true } });
      const occupied = new Set(used.map(item => item.expectedAmount.toString()));
      let expectedAmount = requestedAmount;
      while (occupied.has(expectedAmount.toString()) && expectedAmount < requestedAmount + 10_000n) expectedAmount++;
      if (expectedAmount >= requestedAmount + 10_000n) throw new Error("AMOUNT_UNAVAILABLE");
      return tx.depositIntent.create({ data: { userId, requestedAmount, expectedAmount, gmoAmount: convertUsdtToGmoBaseUnits(expectedAmount)!.gmoBaseUnits, address: config.address, expiresAt: new Date(Date.now() + 30 * 60_000) } });
    });
    return NextResponse.json({ data: { id: intent.id, address: intent.address, amount: `${intent.expectedAmount / 1_000_000n}.${(intent.expectedAmount % 1_000_000n).toString().padStart(6, "0")}`, creditedGmo: intent.gmoAmount.toString(), expiresAt: intent.expiresAt.toISOString() } });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return NextResponse.json({ error: "Too many deposit requests. Please try again later." }, { status: 429 });
    return NextResponse.json({ error: "Could not create a deposit request. Try another amount or retry later." }, { status: 503 });
  }
}
