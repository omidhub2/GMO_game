"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Copy, History, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { WalletConnectButton } from "./wallet-connect-button";
import styles from "./game-menu.module.css";

export type LobbyWalletData = {
  balances: Record<"BALANCE" | "REWARDS" | "PRIZE", string>;
  availableBalance: string;
  demo?: boolean;
  canManageWallet?: boolean;
  deposit?: { address: string; tokenContract: string; exchangeRateConfigured: boolean };
};
type Transaction = { id: string; type: string; amount: string; currency: string; status: string; direction: string; createdAt: string; reference: string | null };
type Tab = "overview" | "deposit" | "withdraw" | "history";
const labels: Record<string, string> = { DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER: "Transfer", TOURNAMENT_ENTRY: "Tournament entry", TOURNAMENT_REFUND: "Tournament refund", PRIZE: "Prize", MISSION_REWARD: "Mission reward", REFERRAL_REWARD: "Referral reward", REWARD: "Reward", PREDICTION: "Prediction", REVERSAL: "Reversal", ADJUSTMENT: "Adjustment" };
const walletSections = [
  { id: "overview", label: "Overview", Icon: Wallet },
  { id: "deposit", label: "Deposit", Icon: ArrowDownLeft },
  { id: "withdraw", label: "Withdraw", Icon: ArrowUpRight },
  { id: "history", label: "History", Icon: History },
] as const;
const format = (raw: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(raw) / 1_000_000);
const usd = (raw: bigint) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 6 }).format(Number(raw) / 10_000_000_000);
function parseUnits(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return units > 0n ? units : null;
}
function readableError(value: unknown, fallback: string) {
  return typeof value === "string" && !/[\u0600-\u06ff]/.test(value) ? value : fallback;
}

export default function LobbyWalletPanel({ data, loading, notice, refresh, initialTab = "overview" }: { data: LobbyWalletData; loading: boolean; notice: string; refresh: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [hash, setHash] = useState("");
  const [depositIntent, setDepositIntent] = useState<{ id: string; address: string; amount: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestKey = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const total = Object.values(data.balances).reduce((sum, raw) => sum + BigInt(raw), 0n);
  const authenticated = !data.demo;

  useEffect(() => {
    if (tab !== "history" && tab !== "overview") return;
    if (!authenticated) { setTransactions([]); return; }
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    void fetch("/api/wallet/history", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Transaction history could not be loaded. Try refreshing.");
        const result = await response.json() as { history: Transaction[] };
        setTransactions(result.history);
      })
      .catch(() => { if (!controller.signal.aborted) { setTransactions([]); setHistoryError("Transaction history could not be loaded. Try refreshing."); } })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [tab, authenticated, historyVersion, data]);

  function changeTab(next: Tab) {
    requestKey.current = null;
    setTab(next); setFeedback(null); setAmount(next === "deposit" && depositIntent ? depositIntent.amount : ""); setDestination(""); setHash(""); setConfirmed(false); setSelected(null);
  }
  function refreshAll() { refresh(); setHistoryVersion(value => value + 1); }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { setFeedback({ ok: false, text: "Copy is unavailable. Select and copy the address manually." }); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback(null);
    if (!authenticated) { setFeedback({ ok: false, text: "Sign in with Telegram before submitting." }); return; }
    const units = parseUnits(amount.trim());
    if (!units) { setFeedback({ ok: false, text: "Enter a positive amount with up to 6 decimal places." }); return; }
    const deposit = tab === "deposit";
    if (deposit && (!data.deposit?.address || !data.deposit.exchangeRateConfigured)) { setFeedback({ ok: false, text: "Deposits are not configured yet." }); return; }
    if (deposit && !depositIntent) { setFeedback({ ok: false, text: "Create a deposit request before sending funds." }); return; }
    if (deposit && !/^[a-fA-F0-9]{64}$/.test(hash)) { setFeedback({ ok: false, text: "Enter the 64-character TRON transaction ID." }); return; }
    if (!deposit && units > BigInt(data.availableBalance)) { setFeedback({ ok: false, text: "This amount exceeds your available GMO balance." }); return; }
    if (!deposit && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(destination)) { setFeedback({ ok: false, text: "Enter a valid TRON address beginning with T." }); return; }
    if (!deposit && !confirmed) { setFeedback({ ok: false, text: "Confirm the destination address before submitting." }); return; }
    submitting.current = true;
    setBusy(true);
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch(deposit ? "/api/wallet/deposits" : "/api/wallet/withdrawals", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current }, body: JSON.stringify(deposit ? { intentId: depositIntent?.id, txHash: hash } : { amount: amount.trim(), address: destination }) });
      const result = await response.json() as { error?: string; data?: { id: string } };
      if (!response.ok) {
        const fallback = response.status === 401 ? "Your session expired. Sign in and try again." : response.status === 409 ? (deposit ? "This transaction has already been submitted." : "Your balance changed or another request is processing. Refresh before trying again.") : response.status === 400 ? "Verification failed. Check the amount, network, and transaction or address details." : "The request could not be verified. Check history before submitting again.";
        throw new Error(readableError(result.error, fallback));
      }
      setFeedback({ ok: true, text: deposit ? `Deposit verified and credited. Reference: ${result.data?.id ?? "See history"}` : `Withdrawal request received for review. Reference: ${result.data?.id ?? "See history"}` });
      setAmount(""); setHash(""); setDestination(""); setConfirmed(false); refreshAll();
      requestKey.current = null;
      setDepositIntent(null);
    } catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Connection interrupted. Check history before submitting again." }); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function prepareDeposit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/wallet/deposits/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amount.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create deposit request.");
      setDepositIntent(result.data);
      setAmount(result.data.amount);
    } catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not create deposit request." }); }
    finally { submitting.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (!authenticated) { setDepositIntent(null); return; }
    const controller = new AbortController();
    void fetch("/api/wallet/deposits/intents", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const result = await response.json();
      if (result.data && !controller.signal.aborted) { setDepositIntent(result.data); setAmount(result.data.amount); }
    }).catch(() => {});
    return () => controller.abort();
  }, [authenticated]);

  const filtered = transactions.filter(item => (type === "ALL" || item.type === type) && (status === "ALL" || item.status === status) && (!from || item.createdAt.slice(0, 10) >= from) && (!to || item.createdAt.slice(0, 10) <= to));
  function transactionRow(item: Transaction) {
    return <button key={`${item.type}-${item.id}`} className={styles.transactionRow} onClick={() => { setSelected(item); setTab("history"); }}><span className={styles.transactionSymbol}>{item.direction === "CREDIT" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><span><strong>{labels[item.type] ?? item.type}</strong><small>{new Date(item.createdAt).toLocaleString("en-US")}</small></span><span className={styles.transactionAmount}><strong>{item.direction === "CREDIT" ? "+" : "−"}{format(item.amount)} {item.currency}</strong><small>{item.status.replaceAll("_", " ")}</small></span></button>;
  }
  return <div className={styles.walletPanel}>
    <div className={styles.walletPanelHeading}><span><Wallet size={20} /> ARENA VAULT</span><small>{data.demo ? "DEMO MODE" : "PERSONAL WALLET"}</small></div>
    <h2 id="menu-dialog-title">YOUR WALLET</h2>
    <nav className={styles.vaultTabs} aria-label="Wallet sections">
      {walletSections.map(({ id, label, Icon }) => (
        <button key={id} type="button" onClick={() => changeTab(id)} disabled={busy} aria-pressed={tab === id} aria-controls="wallet-section-content">
          <span className={styles.vaultTileIcon}><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
          <span className={styles.vaultTileLabel}>{label}</span>
          {tab === id && <Check className={styles.vaultTileCheck} size={15} aria-hidden="true" />}
        </button>
      ))}
    </nav>
    <div id="wallet-section-content" className={styles.vaultContent}>
    {!authenticated && <div className={styles.vaultAuth}><span>Sign in to use your personal wallet.</span><WalletConnectButton /><button onClick={refreshAll} disabled={loading}>Check connection</button></div>}
    {tab === "overview" && <><div className={styles.balanceDisplay}><span>TOTAL GMO BALANCE</span><strong>{format(total.toString())} <small>GMO</small></strong><p>≈ {usd(total)} <span>Estimated USD value</span></p><div className={styles.balanceLine} /></div><dl className={styles.balanceAccounts}>{([{ key: "BALANCE", label: "Balance" }, { key: "REWARDS", label: "Rewards" }, { key: "PRIZE", label: "Prizes" }] as const).map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{format(data.balances[key])}<small>GMO</small></dd></div>)}</dl><div className={styles.available}><ShieldCheck size={15} /><span>Available balance</span><strong>{format(data.availableBalance)} GMO</strong></div><nav className={styles.walletActions} aria-label="Wallet actions"><button onClick={() => changeTab("deposit")}><ArrowDownLeft size={20} />DEPOSIT</button><button onClick={() => changeTab("withdraw")}><ArrowUpRight size={20} />WITHDRAW</button><button onClick={() => changeTab("history")}><History size={20} />HISTORY</button></nav><h3 className={styles.activityHeading}>Recent activity</h3>{historyLoading ? <p>Loading transactions…</p> : transactions.length ? transactions.slice(0, 3).map(transactionRow) : <p className={styles.emptyActivity}>{historyError || (authenticated ? "No transactions yet." : "Sign in to view your transactions.")}</p>}</>}
    {(tab === "deposit" || tab === "withdraw") && <form className={styles.vaultForm} onSubmit={submit}>
      <div className={styles.networkLabel}>{tab === "deposit" ? "RECEIVE USDT" : "WITHDRAW GMO"}<span>TRON NETWORK</span></div>
      {tab === "deposit" ? <><p>Create a payment request, send the exact USDT amount shown within 30 minutes, then submit the transaction ID. The full amount is converted to GMO.</p>{depositIntent && authenticated ? <div className={styles.addressBox}><span>Deposit address</span><code>{depositIntent.address}</code><strong>Send exactly {depositIntent.amount} USDT</strong><small>Pay before {new Date(depositIntent.expiresAt).toLocaleString("en-US")}. Any extra decimal amount identifies your payment and is credited in full.</small><button type="button" onClick={() => void copy(depositIntent!.address)}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy address"}</button></div> : <p className={styles.walletNotice}>{authenticated ? "Enter an amount and create a deposit request to see payment instructions." : "The deposit address will appear after sign-in."}</p>}{authenticated && data.deposit?.exchangeRateConfigured === false && <p className={styles.walletNotice}>Deposit conversion is not configured. Contact support before sending funds.</p>}<label>Deposit amount · USDT<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="10.00" required disabled={busy || Boolean(depositIntent)} /></label>{!depositIntent && <button type="button" className={styles.deploy} onClick={() => void prepareDeposit()} disabled={busy || !authenticated || !data.deposit?.exchangeRateConfigured}>{busy ? "PREPARING..." : "CREATE DEPOSIT REQUEST"}</button>}{depositIntent && <button type="button" onClick={() => { setDepositIntent(null); setAmount(""); setHash(""); }}>Create another deposit request</button>}<label>TRON transaction ID<input value={hash} onChange={e => setHash(e.target.value.trim())} placeholder="64-character transaction hash" minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" required disabled={busy} /></label><small>Use the exact amount and address from your payment request. Wait for network confirmation before verifying. Each transfer is credited once.</small></> : <><p>Withdrawals are reviewed by support. Pending requests reduce your available balance.</p><div className={styles.available}><span>Available</span><strong>{format(data.availableBalance)} GMO</strong></div><label>Withdrawal amount · GMO<div className={styles.maxInput}><input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="100" required disabled={busy} /><button type="button" disabled={busy || !authenticated} onClick={() => setAmount((Number(data.availableBalance) / 1_000_000).toFixed(6))}>MAX</button></div></label><label>Destination TRON address<input value={destination} onChange={e => setDestination(e.target.value.trim())} placeholder="T…" minLength={34} maxLength={34} required disabled={busy} /></label><label className={styles.confirmAddress}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required disabled={busy} />I have checked the destination address.</label></>}
      <button className={styles.deploy} type="submit" disabled={busy || !authenticated || (tab === "deposit" && (!depositIntent || !data.deposit?.address || !data.deposit.exchangeRateConfigured))}>{busy ? "PROCESSING…" : tab === "deposit" ? "VERIFY DEPOSIT" : "REQUEST WITHDRAWAL"}</button>
    </form>}
    {tab === "history" && <div>{selected ? <div className={styles.transactionDetail}><button onClick={() => setSelected(null)}><ArrowLeft size={15} />Back to history</button><h3>{labels[selected.type] ?? selected.type}</h3><strong>{format(selected.amount)} {selected.currency}</strong><dl>{[{ label: "Status", value: selected.status }, { label: "Date", value: new Date(selected.createdAt).toLocaleString("en-US") }, { label: "Reference", value: selected.reference ?? selected.id }].map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div> : <><div className={styles.historyFilters}><label>Type<select value={type} onChange={e => setType(e.target.value)}><option value="ALL">All types</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All statuses</option>{["PENDING", "PROCESSING", "COMPLETED", "REJECTED", "FAILED", "CANCELLED", "REVERSED"].map(value => <option key={value}>{value}</option>)}</select></label><label>From<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label></div><div className={styles.historyCount}><span>{filtered.length} transactions · Up to 500 recent records</span><button onClick={() => { setType("ALL"); setStatus("ALL"); setFrom(""); setTo(""); }}>Clear filters</button></div>{historyLoading ? <p>Loading history…</p> : historyError ? <p role="alert">{historyError}</p> : filtered.length ? filtered.map(transactionRow) : <p className={styles.emptyActivity}>{authenticated ? "No transactions match these filters." : "Sign in to view your transaction history."}</p>}</>}</div>}
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={feedback.ok ? styles.vaultSuccess : styles.vaultError}>{feedback.text}</p>}
    {data.canManageWallet && <Link href="/admin/wallet">Review withdrawals</Link>}
    </div>
    <div className={styles.walletPanelFooter}><span>100 GMO = $0.01 · Estimated value</span><button onClick={refreshAll} disabled={loading || busy || historyLoading}><RefreshCw size={14} className={loading ? styles.spin : ""} />Refresh</button></div>{notice && <p className={styles.walletNotice}>{notice}</p>}
  </div>;
}

