"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWalletSession } from "@/components/wallet-session";

const labels: Record<string, string> = { DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER: "Transfer", TOURNAMENT_ENTRY: "Tournament entry", TOURNAMENT_REFUND: "Refund tournament", PRIZE: "جایزه", MISSION_REWARD: "پاداش مأموریت", REFERRAL_REWARD: "پاداش دعوت", PREDICTION: "Prediction ورزشی", REWARD: "پاداش", ADJUSTMENT: "اصلاح موجودی" };
const statuses: Record<string, string> = { COMPLETED: "Completed", PENDING: "Pending review", PROCESSING: "Processing", REJECTED: "Rejected", FAILED: "Failed", CANCELLED: "Cancelled", REVERSED: "Reversed" };
const demoMode = process.env.NODE_ENV !== "production";
type WalletTransaction = { id: string; type: string; title: string; description: string; reference: string | null; amount: string; currency: string; direction: string; status: string; createdAt: string };

export function WalletTransactionDetailPage({ id }: { id: string }) {
  const session = useWalletSession();
  const [transaction, setTransaction] = useState<WalletTransaction | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (!session && demoMode) params.set("demo", "1");
    void fetch(`/api/wallet/${encodeURIComponent(id)}?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { data: WalletTransaction; demo?: boolean } : null)
      .then((result) => {
        setTransaction(result?.data ?? null);
        setNotFound(!result?.data);
        setDemo(Boolean(result?.demo));
      })
      .catch(() => { setTransaction(null); setNotFound(true); });
  }, [id, session]);

  return <main className="main-content wallet-page wallet-detail-page"><Link className="wallet-back-link" href="/wallet/history">‹ Back to history</Link><header className="wallet-hero"><div><div className="eyebrow">TRANSACTION DETAIL</div><h1>Transaction details</h1><p className="subtle">Details recorded in the wallet ledger</p></div></header>{demo && <div className="wallet-callout wallet-demo-note">Local demo data</div>}{transaction ? <section className="panel wallet-detail-card"><div className="wallet-detail-symbol">{transaction.direction === "CREDIT" ? "↓" : "↑"}</div><h2>{transaction.title || labels[transaction.type] || transaction.type}</h2><strong className={`wallet-detail-amount ${transaction.direction === "CREDIT" ? "wallet-credit" : "wallet-debit"}`}>{transaction.direction === "CREDIT" ? "+" : "−"}{new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(Number(transaction.amount) / 1_000_000)} {transaction.currency}</strong><span className={`wallet-status wallet-status-${transaction.status.toLowerCase()}`}>{statuses[transaction.status] ?? transaction.status}</span><dl><div><dt>نوع</dt><dd>{labels[transaction.type] ?? transaction.type}</dd></div><div><dt>زمان</dt><dd>{new Date(transaction.createdAt).toLocaleString("fa-IR")}</dd></div><div><dt>شرح</dt><dd>{transaction.description || "—"}</dd></div><div><dt>شناسهٔ پیگیری</dt><dd dir="ltr">{transaction.reference ?? transaction.id}</dd></div></dl></section> : notFound ? <section className="panel wallet-empty-transactions"><strong>transactions پیدا نشد</strong><p>This transaction is not in your wallet history.</p><Link className="wallet-secondary-button" href="/wallet/history">Back to history</Link></section> : <section className="panel wallet-empty-transactions"><p>Loading transaction details…</p></section>}</main>;
}
