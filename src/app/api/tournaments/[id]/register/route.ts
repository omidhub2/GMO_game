import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: "برای ثبت‌نام باید وارد حساب کاربری شوی." }, { status: 401 });

  try {
    const { id: tournamentId } = await params;
    const prisma = getPrisma();
    const participant = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, title: true, status: true, demoContent: true, entryFee: true, currency: true, registrationStartsAt: true, registrationEndsAt: true, maxParticipants: true },
      });
      const now = new Date();
      if (!tournament || tournament.demoContent) throw new Error("TOURNAMENT_UNAVAILABLE");
      if (tournament.status !== "REGISTRATION_OPEN" || now < tournament.registrationStartsAt || now > tournament.registrationEndsAt) throw new Error("REGISTRATION_CLOSED");
      if (tournament.currency !== "GMO" || tournament.entryFee < 0n) throw new Error("UNSUPPORTED_TOURNAMENT_CURRENCY");

      const existing = await tx.tournamentParticipant.findUnique({ where: { tournamentId_userId: { tournamentId, userId } }, select: { id: true, status: true } });
      if (existing && existing.status !== "WITHDRAWN") throw new Error("ALREADY_REGISTERED");
      const registeredCount = await tx.tournamentParticipant.count({ where: { tournamentId, status: { in: ["REGISTERED", "CONFIRMED"] } } });
      if (registeredCount >= tournament.maxParticipants) throw new Error("TOURNAMENT_FULL");

      if (tournament.entryFee > 0n) {
        const account = await tx.walletAccount.findFirst({ where: { userId, currency: "GMO", accountType: "BALANCE", isActive: true }, select: { id: true } });
        const system = await tx.walletAccount.findFirst({ where: { userId: null, currency: "GMO", accountType: "SYSTEM", isActive: true }, select: { id: true } });
        if (!account || !system) throw new Error("WALLET_LEDGER_ACCOUNTS_MISSING");
        await tx.$queryRaw`SELECT id FROM wallet_accounts WHERE id = ${account.id}::uuid FOR UPDATE`;
        const [entries, pendingWithdrawals, reservations] = await Promise.all([
          tx.ledgerEntry.groupBy({ by: ["direction"], where: { accountId: account.id, transaction: { status: "COMPLETED" } }, _sum: { amount: true } }),
          tx.withdrawal.aggregate({ where: { userId, currency: "GMO", status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
          tx.walletReservation.aggregate({ where: { userId, status: "RESERVED" }, _sum: { amount: true } }),
        ]);
        let available = 0n;
        for (const entry of entries) available += entry.direction === "CREDIT" ? entry._sum.amount ?? 0n : -(entry._sum.amount ?? 0n);
        available -= (pendingWithdrawals._sum.amount ?? 0n) + (reservations._sum.amount ?? 0n);
        if (available < tournament.entryFee) throw new Error("INSUFFICIENT_FUNDS");

        const key = `tournament-entry:${tournamentId}:${userId}`;
        const ledger = await tx.ledgerTransaction.create({
          data: { reference: key, idempotencyKey: key, type: "TOURNAMENT_ENTRY", status: "COMPLETED", description: `هزینهٔ ثبت‌نام: ${tournament.title}`, actorId: userId, metadata: { tournamentId, demo: false } },
          select: { id: true },
        });
        await tx.ledgerEntry.createMany({
          data: [
            { transactionId: ledger.id, accountId: account.id, amount: tournament.entryFee, direction: "DEBIT" },
            { transactionId: ledger.id, accountId: system.id, amount: tournament.entryFee, direction: "CREDIT" },
          ]
        });
      }

      if (existing) return tx.tournamentParticipant.update({ where: { id: existing.id }, data: { status: "REGISTERED", registeredAt: now }, select: { id: true, status: true, registeredAt: true } });
      return tx.tournamentParticipant.create({ data: { tournamentId, userId, status: "REGISTERED" }, select: { id: true, status: true, registeredAt: true } });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ data: { ...participant, entryFee: "charged atomically at registration" }, message: "ثبت‌نام انجام شد و هزینه در صورت وجود به‌صورت اتمیک از اعتبار کسر شد." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = (error as { code?: string })?.code;
    if (message === "TOURNAMENT_UNAVAILABLE") return NextResponse.json({ error: "تورنومنت در دسترس نیست یا نمایشی است." }, { status: 404 });
    if (message === "REGISTRATION_CLOSED") return NextResponse.json({ error: "مهلت ثبت‌نام این تورنومنت باز نیست." }, { status: 409 });
    if (message === "UNSUPPORTED_TOURNAMENT_CURRENCY") return NextResponse.json({ error: "ارز ورودی این تورنومنت پشتیبانی نمی‌شود." }, { status: 422 });
    if (message === "ALREADY_REGISTERED" || code === "P2002") return NextResponse.json({ error: "قبلاً در این تورنومنت ثبت‌نام کرده‌ای." }, { status: 409 });
    if (message === "TOURNAMENT_FULL") return NextResponse.json({ error: "ظرفیت تورنومنت تکمیل شده است." }, { status: 409 });
    if (message === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "اعتبار قابل‌استفاده برای پرداخت ورودی کافی نیست." }, { status: 409 });
    if (message === "WALLET_LEDGER_ACCOUNTS_MISSING") return NextResponse.json({ error: "حساب‌های دفترکل برای پرداخت آماده نیستند." }, { status: 503 });
    if (code === "P2034") return NextResponse.json({ error: "عملیات هم‌زمانی انجام شد؛ دوباره تلاش کن." }, { status: 409 });
    return NextResponse.json({ error: "ثبت‌نام تورنومنت انجام نشد." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: "برای انصراف باید وارد حساب کاربری شوی." }, { status: 401 });

  try {
    const { id: tournamentId } = await params;
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
      const tournament = await tx.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, title: true, status: true, demoContent: true, entryFee: true, startsAt: true } });
      if (!tournament || tournament.demoContent) throw new Error("TOURNAMENT_UNAVAILABLE");
      if (tournament.startsAt <= new Date() || ["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(tournament.status)) throw new Error("WITHDRAWAL_CLOSED");
      const participant = await tx.tournamentParticipant.findUnique({ where: { tournamentId_userId: { tournamentId, userId } }, select: { id: true, status: true } });
      if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");
      if (participant.status === "WITHDRAWN") return { refunded: false, participantId: participant.id };
      await tx.$queryRaw`SELECT id FROM tournament_participants WHERE id = ${participant.id}::uuid FOR UPDATE`;
      await tx.tournamentParticipant.update({ where: { id: participant.id }, data: { status: "WITHDRAWN" } });

      if (tournament.entryFee > 0n) {
        const account = await tx.walletAccount.findFirst({ where: { userId, currency: "GMO", accountType: "BALANCE", isActive: true }, select: { id: true } });
        const system = await tx.walletAccount.findFirst({ where: { userId: null, currency: "GMO", accountType: "SYSTEM", isActive: true }, select: { id: true } });
        if (!account || !system) throw new Error("WALLET_LEDGER_ACCOUNTS_MISSING");
        const key = `tournament-refund:${participant.id}`;
        const existingRefund = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
        if (!existingRefund) {
          const ledger = await tx.ledgerTransaction.create({ data: { reference: key, idempotencyKey: key, type: "TOURNAMENT_REFUND", status: "COMPLETED", description: `بازپرداخت ورودی: ${tournament.title}`, actorId: userId, metadata: { tournamentId, participantId: participant.id } }, select: { id: true } });
          await tx.ledgerEntry.createMany({
            data: [
              { transactionId: ledger.id, accountId: system.id, amount: tournament.entryFee, direction: "DEBIT" },
              { transactionId: ledger.id, accountId: account.id, amount: tournament.entryFee, direction: "CREDIT" },
            ]
          });
        }
      }
      return { refunded: tournament.entryFee > 0n, participantId: participant.id };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: result, message: result.refunded ? "از تورنومنت انصراف دادی و ورودی به اعتبارت برگشت." : "از تورنومنت انصراف دادی." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = (error as { code?: string })?.code;
    if (message === "TOURNAMENT_UNAVAILABLE" || message === "PARTICIPANT_NOT_FOUND") return NextResponse.json({ error: "ثبت‌نام فعالی برای این تورنومنت پیدا نشد." }, { status: 404 });
    if (message === "WITHDRAWAL_CLOSED") return NextResponse.json({ error: "در این مرحله امکان انصراف از تورنومنت وجود ندارد." }, { status: 409 });
    if (message === "WALLET_LEDGER_ACCOUNTS_MISSING") return NextResponse.json({ error: "حساب‌های دفترکل برای بازپرداخت آماده نیستند." }, { status: 503 });
    if (code === "P2034") return NextResponse.json({ error: "عملیات هم‌زمانی انجام شد؛ دوباره تلاش کن." }, { status: 409 });
    return NextResponse.json({ error: "انصراف از تورنومنت انجام نشد." }, { status: 503 });
  }
}
