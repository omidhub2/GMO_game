"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HistoryRow } from "@/components/wallet-page";
import { useWalletSession } from "@/components/wallet-session";

type WalletTransaction = { id: string; type: string; title: string; description: string; reference: string | null; amount: string; currency: string; direction: string; status: string; createdAt: string };
type WalletResponse = { history: WalletTransaction[]; demo?: boolean; error?: string };
const demoMode = process.env.NODE_ENV !== "production";

export function WalletHistoryPage() {
  const session = useWalletSession();
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "ALL", status: "ALL", from: "", to: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: filters.type, status: filters.status });
    if (!session && demoMode) params.set("demo", "1");
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    try {
      const response = await fetch(`/api/wallet/history?${params.toString()}`, { cache: "no-store" });
      const result = await response.json() as WalletResponse;
      setData(response.ok ? result : { history: [], error: result.error ?? "تاریخچه دریافت نشد." });
    } catch {
      setData({ history: [], error: "اتصال به تاریخچه ممکن نشد." });
    } finally { setLoading(false); }
  }, [filters, session]);

  useEffect(() => { void load(); }, [load]);

  const setFilter = (name: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [name]: value }));

  return <main className="main-content wallet-page wallet-history-route">
    <Link className="wallet-back-link" href="/wallet">‹ Back to wallet</Link>
    <header className="wallet-hero"><div><div className="eyebrow">TRANSACTION CENTER</div><h1>تاریخچهٔ transactions‌ها</h1><p className="subtle">همهٔ Depositها، Withdrawal‌ها، جوایز و هزینه‌های بازی در یک جا</p></div><div className="wallet-history-total"><strong>{data?.history.length ?? 0}</strong><span>transactions</span></div></header>
    {data?.demo && <div className="wallet-callout wallet-demo-note" role="status">This is sample data for the local preview.</div>}
    <section className="panel wallet-history-panel wallet-history-full">
      <div className="wallet-filters-heading"><div><h2>Filters</h2><p>با نوع، Status یا تاریخ دقیق‌تر جستجو کن.</p></div><button className="wallet-secondary-button" type="button" onClick={() => setFilters({ type: "ALL", status: "ALL", from: "", to: "" })}>Clear all</button></div>
      <div className="wallet-filters wallet-filters-rich">
        <label><span>Transaction type</span><select value={filters.type} onChange={(event) => setFilter("type", event.target.value)}><option value="ALL">همهٔ transactions‌ها</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TOURNAMENT_ENTRY">Tournament entry</option><option value="TOURNAMENT_REFUND">Refund</option><option value="PRIZE">Tournament prizes</option><option value="REWARD">Rewards</option><option value="PREDICTION">Prediction</option><option value="TRANSFER">Transfer</option><option value="ADJUSTMENT">Other</option></select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="ALL">همهٔ Status‌ها</option><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option></select></label>
        <label><span>From date</span><input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label>
        <label><span>To date</span><input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label>
      </div>
      {data?.demo && <p className="wallet-demo-footnote">نمونهٔ محلی برای پیش‌نمایش است؛ داده‌ها ارزش واقعی ندارند.</p>}
    </section>
    <section className="panel wallet-history-panel wallet-history-full-list"><div className="wallet-panel-heading"><div><span className="eyebrow">ACTIVITY</span><h2>لیست transactions‌ها</h2></div><span className="wallet-live-label"><i /> به‌روز</span></div>{loading ? <p className="subtle">در حال بارگذاری…</p> : data?.error ? <div className="wallet-callout wallet-error">{data.error}</div> : data?.history.length ? <div className="wallet-history-list">{data.history.map((transaction) => <HistoryRow key={`${transaction.type}-${transaction.id}`} item={transaction} onClick={() => window.location.assign(`/wallettransactions/${encodeURIComponent(transaction.id)}${data.demo ? "?demo=1" : ""}`)} />)}</div> : <div className="wallet-empty-transactions"><span aria-hidden="true">◷</span><strong>transactionsی پیدا نشد</strong><p>Filters را تغییر بده یا بازهٔ تاریخ را پاک کن.</p></div>}{data?.history.length === 500 && <p className="wallet-history-footnote">۵۰۰ مورد اخیر در این فیلتر نمایش داده شده‌اند.</p>}</section>
  </main>;
}
