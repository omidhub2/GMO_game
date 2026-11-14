export const USER_WALLET_TYPES = ["BALANCE", "REWARDS", "PRIZE"] as const;
export type UserWalletType = (typeof USER_WALLET_TYPES)[number];

export interface WalletAccountSummary {
  accountId: string;
  type: UserWalletType;
  balance: bigint;
  isActive: boolean;
}
export interface WalletSummary {
  currency: "GMO";
  accounts: Record<UserWalletType, { balance: bigint; isActive: boolean }>;
  total: bigint;
}

/** Computes display totals only from ledger-derived account balances; does not persist a balance projection. */
export function summarizeWallet(accounts: readonly WalletAccountSummary[]): WalletSummary {
  const byType = new Map<UserWalletType, WalletAccountSummary>();
  for (const account of accounts) {
    if (account.balance < 0n) throw new Error("User wallet accounts cannot have a negative balance.");
    if (byType.has(account.type)) throw new Error(`Duplicate ${account.type} wallet account.`);
    byType.set(account.type, account);
  }
  const summary = Object.fromEntries(USER_WALLET_TYPES.map((type) => {
    const account = byType.get(type);
    if (!account) throw new Error(`Missing ${type} wallet account.`);
    return [type, { balance: account.balance, isActive: account.isActive }];
  })) as WalletSummary["accounts"];
  return { currency: "GMO", accounts: summary, total: USER_WALLET_TYPES.reduce((sum, type) => sum + summary[type].balance, 0n) };
}
