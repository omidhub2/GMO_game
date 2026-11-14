import { describe, expect, it } from "vitest";
import { createSingleEliminationBracket } from "../src/modules/tournaments/domain/bracket";
import { calculateElo } from "../src/modules/rankings/domain/elo";
import { summarizeWallet } from "../src/modules/wallet/domain/wallet";
import { LedgerValidationError, validateLedgerCommand } from "../src/modules/wallet/domain/ledger";
import { registerForTournament, RegistrationError, type RegistrationDependencies, type RegistrationTransactionClient } from "../src/modules/tournaments/domain/registration";

describe("single elimination brackets", () => {
  it("generates byes and a complete tree for a non-power-of-two field", () => {
    const bracket = createSingleEliminationBracket([{ id: "a", seed: 1 }, { id: "b", seed: 2 }, { id: "c", seed: 3 }, { id: "d", seed: 4 }, { id: "e", seed: 5 }]);
    expect(bracket.bracketSize).toBe(8);
    expect(bracket.roundCount).toBe(3);
    expect(bracket.matches).toHaveLength(7);
    expect(bracket.matches.filter((match) => match.round === 1 && match.bye)).toHaveLength(3);
  });
  it("rejects fewer than two or duplicate participants", () => {
    expect(() => createSingleEliminationBracket([{ id: "a" }])).toThrow();
    expect(() => createSingleEliminationBracket([{ id: "a" }, { id: "a" }])).toThrow();
  });
});

describe("Elo ratings", () => {
  it("preserves rating sum and awards an upset with a larger gain", () => {
    const upset = calculateElo(1000, 1400, { scoreA: 1 });
    const expected = calculateElo(1000, 1400, { scoreA: 0 });
    expect(upset.ratingA + upset.ratingB).toBe(2400);
    expect(upset.deltaA).toBeGreaterThan(0);
    expect(Math.abs(upset.deltaA)).toBeGreaterThan(Math.abs(expected.deltaA));
  });
  it("supports draws and rejects invalid inputs", () => {
    expect(calculateElo(1200, 1200, { scoreA: 0.5 }).deltaA).toBe(0);
    expect(() => calculateElo(-1, 1000)).toThrow();
  });
});

describe("wallet and immutable ledger command validation", () => {
  it("summarizes the three separate wallet accounts", () => {
    const wallet = summarizeWallet([
      { accountId: "1", type: "BALANCE", balance: 100n, isActive: true },
      { accountId: "2", type: "REWARDS", balance: 50n, isActive: true },
      { accountId: "3", type: "PRIZE", balance: 10n, isActive: false },
    ]);
    expect(wallet.total).toBe(160n);
  });
  it("accepts balanced postings and refuses unbalanced ledgers", () => {
    const valid = {
      reference: "r", idempotencyKey: "i", description: "test", type: "TRANSFER" as const, postings: [
        { accountId: "a", accountType: "BALANCE" as const, amount: 10n, direction: "DEBIT" as const },
        { accountId: "b", accountType: "SYSTEM" as const, amount: 10n, direction: "CREDIT" as const },
      ]
    };
    expect(() => validateLedgerCommand(valid)).not.toThrow();
    expect(() => validateLedgerCommand({ ...valid, postings: [{ ...valid.postings[0], amount: 9n }, valid.postings[1]] })).toThrow(LedgerValidationError);
  });
});

describe("tournament registration safeguards", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const tournament = { status: "REGISTRATION_OPEN" as const, registrationStartsAt: new Date("2026-11-01T00:00:00Z"), registrationEndsAt: new Date("2026-11-06T00:00:00Z"), startsAt: new Date("2026-11-07T00:00:00Z"), maxParticipants: 8, entryFee: 0n, demoContent: false };
  const deps: RegistrationDependencies = {
    findTournamentForUpdate: async () => tournament,
    countActiveParticipants: async () => 0,
    findParticipant: async () => null,
    registerParticipant: async () => ({ id: "participant-1", status: "REGISTERED" }),
    chargeEntryFee: async () => { throw new Error("free tournament should not charge"); },
  };
  const client: RegistrationTransactionClient = { $transaction: async (fn) => fn(deps) };
  it("allows an eligible free registration in a serializable transaction", async () => {
    const result = await registerForTournament(client, deps, { tournamentId: "t", userId: "u", idempotencyKey: "key", now });
    expect(result).toEqual({ participantId: "participant-1", status: "REGISTERED" });
  });
  it("refuses demo tournaments and calls a configured financial adapter for paid entries", async () => {
    const demoDeps: RegistrationDependencies = { ...deps, findTournamentForUpdate: async () => ({ ...tournament, demoContent: true }) };
    const demoClient: RegistrationTransactionClient = { $transaction: async (fn) => fn(demoDeps) };
    let demoError: unknown;
    try { await registerForTournament(demoClient, demoDeps, { tournamentId: "t", userId: "u", idempotencyKey: "key", now }); } catch (error) { demoError = error; } 
    expect(demoError).toBeInstanceOf(RegistrationError);

    let chargedAmount = 0n;
    const paidDeps: RegistrationDependencies = {
      ...deps,
      findTournamentForUpdate: async () => ({ ...tournament, entryFee: 50n }),
      chargeEntryFee: async ({ amount }) => { chargedAmount = amount; },
    };
    const paidClient: RegistrationTransactionClient = { $transaction: async (fn) => fn(paidDeps) };
    const result = await registerForTournament(paidClient, paidDeps, { tournamentId: "t", userId: "u", idempotencyKey: "paid-key", now });
    expect(result.status).toBe("REGISTERED");
    expect(chargedAmount).toBe(50n);
  });
});
