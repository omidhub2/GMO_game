export type WalletType = "BALANCE" | "REWARDS" | "PRIZE" | "SYSTEM";
export type LedgerDirection = "DEBIT" | "CREDIT";
export interface LedgerPosting { accountId: string; accountType: WalletType; amount: bigint; direction: LedgerDirection }
export interface LedgerCommand {
  reference: string;
  idempotencyKey: string;
  description: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "TOURNAMENT_ENTRY" | "TOURNAMENT_REFUND" | "PRIZE" | "MISSION_REWARD" | "REFERRAL_REWARD" | "REVERSAL" | "ADJUSTMENT";
  postings: readonly LedgerPosting[];
}
export interface LedgerEntryRow { direction: LedgerDirection; _sum: { amount: bigint | null } }
export interface LedgerTransactionClient {
  $transaction<T>(operation: (transaction: LedgerTransactionClient) => Promise<T>): Promise<T>;
  ledgerTransaction: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<{ id: string; reference: string } | null>;
    create(args: { data: { reference: string; idempotencyKey: string; type: LedgerCommand["type"]; description: string } }): Promise<{ id: string; reference: string }>;
  };
  ledgerEntry: {
    createMany(args: { data: readonly { transactionId: string; accountId: string; amount: bigint; direction: LedgerDirection }[] }): Promise<{ count: number }>;
    groupBy(args: { by: ["direction"]; where: { accountId: string }; _sum: { amount: true } }): Promise<LedgerEntryRow[]>;
  };
  walletAccount: {
    findMany(args: { where: { id: { in: readonly string[] }; isActive: true }; select: { id: true; accountType: true } }): Promise<{ id: string; accountType: WalletType }[]>;
  };
}
export class LedgerValidationError extends Error { constructor(message: string) { super(message); this.name = "LedgerValidationError"; } }

export function validateLedgerCommand(command: LedgerCommand): void {
  if (!command.reference.trim() || !command.idempotencyKey.trim()) throw new LedgerValidationError("Reference and idempotency key are required.");
  if (command.postings.length < 2) throw new LedgerValidationError("A ledger transaction requires at least two postings.");
  const ids = new Set<string>();
  let debits = 0n;
  let credits = 0n;
  for (const posting of command.postings) {
    if (!posting.accountId.trim() || posting.amount <= 0n) throw new LedgerValidationError("Posting account and amount must be valid.");
    if (ids.has(posting.accountId)) throw new LedgerValidationError("A transaction may only post once per account.");
    ids.add(posting.accountId);
    if (posting.direction === "DEBIT") debits += posting.amount;
    else credits += posting.amount;
  }
  if (debits !== credits) throw new LedgerValidationError("Ledger debits and credits must balance exactly.");
}

/** Persist balanced entries and transaction atomically; production adapters must lock wallet rows. */
export async function postLedgerTransaction(client: LedgerTransactionClient, command: LedgerCommand): Promise<{ id: string; reference: string; duplicate: boolean }> {
  validateLedgerCommand(command);
  return client.$transaction(async (tx) => {
    const previous = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (previous) return { ...previous, duplicate: true };
    const ids = command.postings.map(({ accountId }) => accountId);
    const accounts = await tx.walletAccount.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, accountType: true } });
    if (accounts.length !== ids.length) throw new LedgerValidationError("One or more wallet accounts are missing or inactive.");
    const types = new Map(accounts.map(({ id, accountType }) => [id, accountType]));
    for (const posting of command.postings) {
      if (types.get(posting.accountId) !== posting.accountType) throw new LedgerValidationError("Wallet account type does not match requested posting.");
      if (posting.direction === "DEBIT" && posting.accountType !== "SYSTEM" && await accountBalance(tx, posting.accountId) < posting.amount) throw new LedgerValidationError("Insufficient funds in wallet account.");
    }
    const transaction = await tx.ledgerTransaction.create({ data: { reference: command.reference, idempotencyKey: command.idempotencyKey, type: command.type, description: command.description } });
    await tx.ledgerEntry.createMany({ data: command.postings.map(({ accountId, amount, direction }) => ({ transactionId: transaction.id, accountId, amount, direction })) });
    return { ...transaction, duplicate: false };
  });
}
async function accountBalance(client: LedgerTransactionClient, accountId: string): Promise<bigint> {
  const rows = await client.ledgerEntry.groupBy({ by: ["direction"], where: { accountId }, _sum: { amount: true } });
  let credits = 0n;
  let debits = 0n;
  for (const row of rows) { if (row.direction === "CREDIT") credits = row._sum.amount ?? 0n; else debits = row._sum.amount ?? 0n; }
  return credits - debits;
}
