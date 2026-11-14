"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useWalletSession } from "@/components/wallet-session";

type HistoryItem = { id: string; type: string; title: string; description: string; reference: string | null; amount: string; currency: string; direction: string; status: string; createdAt: string };
type WalletData = { balances: Record<"BALANCE" | "REWARDS" | "PRIZE", string>; availableBalance: string; history: HistoryItem[]; demo?: boolean; deposit: { address: string; tokenContract: string; guideVideoUrl: string; exchangeRateConfigured: boolean } };
type WalletTab = "overview" | "deposit" | "withdraw";

const labels = { BALANCE: "اعتبار", REWARDS: "پاداش", PRIZE: "جوایز" } as const;
const statusLabels: Record<string, string> = { PENDING: "Pending review", PROCESSING: "Processing", COMPLETED: "Completed", FAILED: "Failed", CANCELLED: "Cancelled", REJECTED: "Rejected", REVERSED: "Reversed" };
const typeLabels: Record<string, string> = { DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER: "Transfer", TOURNAMENT_ENTRY: "Tournament entry", TOURNAMENT_REFUND: "Refund tournament", PRIZE: "جایزه", MISSION_REWARD: "پاداش مأموریت", REFERRAL_REWARD: "پاداش دعوت", PREDICTION: "Prediction ورزشی", REVERSAL: "برگشت transactions", ADJUSTMENT: "اصلاح موجودی" };

function formatAmount(raw: string) {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(Number(raw) / 1_000_000);
}

function videoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (parsed.hostname === "vimeo.com") return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean)[0] ?? ""}`;
    return "";
  } catch { return ""; }
}

export function WalletPage() {
  const session = useWalletSession();
  const [data, setData] = useState<WalletData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WalletTab>("overview");
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "deposit" || tab === "withdraw") setActiveTab(tab);
  }, []);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!session && process.env.NODE_ENV !== "production") params.set("demo", "1");
      const query = params.toString();
      const [response, historyResponse] = await Promise.all([
        fetch(`/api/wallet${query ? `?${query}` : ""}`, { cache: "no-store" }),
        fetch(`/api/wallet/history${query ? `?${query}` : ""}`, { cache: "no-store" }),
      ]);
      const result = await response.json() as Omit<WalletData, "history"> & { error?: string };
      const historyResult = await historyResponse.json() as { history?: HistoryItem[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "اطلاعات کیف پول دریافت نشد.");
      if (!historyResponse.ok) throw new Error(historyResult.error ?? "تاریخچهٔ کیف پول دریافت نشد.");
      setData({ ...result, history: historyResult.history ?? [] });
      setLoadError("");
    } catch (cause) {
      setData(null);
      setLoadError(cause instanceof Error ? cause.message : "اتصال به کیف پول ممکن نشد.");
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { void loadWallet(); }, [loadWallet]);

  async function submitDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!session) { setError("برای ثبت Deposit باید ابتدا وارد حساب کاربری شوی."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/wallet/deposits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash, amount }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "ثبت Deposit ممکن نشد.");
      setMessage(result.message ?? "درخواست ثبت شد.");
      setAmount("");
      setTxHash("");
      await loadWallet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت درخواست Deposit Failed بود.");
    } finally { setSubmitting(false); }
  }

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/wallet/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, address: withdrawAddress }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "ثبت درخواست Withdrawal ممکن نشد.");
      setMessage(result.message ?? "درخواست Withdrawal ثبت شد.");
      setAmount("");
      setWithdrawAddress("");
      await loadWallet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ثبت درخواست Withdrawal Failed بود.");
    } finally { setSubmitting(false); }
  }

  const embedUrl = data?.deposit.guideVideoUrl ? videoEmbedUrl(data.deposit.guideVideoUrl) : "";
  const balances = data?.balances;
  const demo = Boolean(data?.demo);
  const historyUrl = `/wallet/history${demo ? "?demo=1" : ""}`;

  return <main className="main-content wallet-page">
    <header className="wallet-hero"><div><div className="eyebrow">GMO WALLET · ACCOUNT</div><h1>کیف پول من</h1><p className="subtle">اعتبار، پاداش و جوایز تو در یک نگاه</p></div><div className="wallet-safe-badge"><span /> دفترکل امن GMO</div></header>
    {demo && <div className="wallet-callout wallet-demo-note" role="status"><strong>حالت نمونهٔ محلی</strong><span>موجودی‌ها و transactions‌ها صرفاً نمایشی هستند و ارزش واقعی ندارند.</span></div>}
    {loadError && !demo && <div className="wallet-callout wallet-error" role="alert">{loadError}</div>}

    <section className="wallet-balance-grid" aria-label="موجودی کیف پول">
      {(["BALANCE", "REWARDS", "PRIZE"] as const).map((type) => <article className={`wallet-balance-card wallet-balance-${type.toLowerCase()}`} key={type}><span className="wallet-balance-icon" aria-hidden="true">{type === "BALANCE" ? "◈" : type === "REWARDS" ? "✦" : "♛"}</span><span className="wallet-balance-label">{labels[type]}</span><strong>{loading ? "…" : balances ? formatAmount(balances[type]) : "—"}<small>GMO</small></strong>{type === "BALANCE" && session && data && <span className="wallet-available">قابل Withdrawal: {formatAmount(data.availableBalance)} GMO</span>}<span className="wallet-balance-glow" aria-hidden="true" /></article>)}
    </section>

    <nav className="wallet-action-cards" aria-label="عملیات کیف پول">
      <button type="button" className={`wallet-action-card wallet-action-deposit${activeTab === "deposit" ? " selected" : ""}`} onClick={() => { setActiveTab("deposit"); setError(""); setMessage(""); }}><span aria-hidden="true">↓</span><strong>Deposit</strong><small>راهنما و ارسال هش</small></button>
      <button type="button" className={`wallet-action-card${activeTab === "withdraw" ? " selected" : ""}`} onClick={() => { setActiveTab("withdraw"); setError(""); setMessage(""); }}><span aria-hidden="true">↑</span><strong>Withdrawal</strong><small>درخواست Withdrawal</small></button>
      <a className="wallet-action-card" href={historyUrl}><span aria-hidden="true">◷</span><strong>تاریخچه</strong><small>فیلتر و جستجوی transactions‌ها</small></a>
    </nav>

    {activeTab === "overview" && <section className="panel wallet-overview-panel">
      <div className="wallet-panel-heading"><div><span className="eyebrow">WALLET ACTIVITY</span><h2>۵ transactions آخر</h2></div><a className="wallet-secondary-button" href={historyUrl}>مشاهدهٔ همهٔ transactions‌ها <span aria-hidden="true">‹</span></a></div>
      {data?.history.length ? <div className="wallet-history-list">{data.history.slice(0, 5).map((item) => <HistoryRow key={`${item.type}-${item.id}`} item={item} onClick={() => window.location.assign(`/wallettransactions/${encodeURIComponent(item.id)}${demo ? "?demo=1" : ""}`)} />)}</div> : <p className="subtle">{loading ? "در حال دریافت transactions‌ها…" : "transactionsی در تاریخچه نیست."}</p>}
    </section>}

    {activeTab === "deposit" && <section className="wallet-deposit-layout">
      <section className="panel wallet-form-panel">
        <span className="eyebrow">ADD FUNDS</span><h2>Deposit به کیف پول</h2>
        <p className="subtle">بدون اتصال ولت، USDT را روی شبکهٔ TRON به آدرس رسمی بفرست و هش transactions را ثبت کن؛ سیستم، مقصد و مبلغ را از روی شبکه بررسی می‌کند.</p>
        {data?.deposit.address ? <div className="deposit-address"><span>آدرس رسمی Deposit</span><code dir="ltr">{data.deposit.address}</code><button type="button" className="wallet-secondary-button" onClick={() => void navigator.clipboard?.writeText(data.deposit.address)}>کپی آدرس</button></div> : <div className="wallet-callout wallet-error">آدرس دریافت توسط مدیر تنظیم نشده است.</div>}
        {data?.deposit.tokenContract && <p className="deposit-token-note">قرارداد رسمی USDT: <code dir="ltr">{data.deposit.tokenContract}</code></p>}
        {data?.deposit.exchangeRateConfigured === false && <div className="wallet-callout wallet-error">نرخ تبدیل USDT به GMO تنظیم نشده؛ شارژ واقعی هنوز غیرفعال است.</div>}
        <form className="deposit-form" onSubmit={submitDeposit}>
          <label>مبلغ Depositی USDT<input inputMode="decimal" autoComplete="off" placeholder="مثلاً 10.5" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>هش transactions<input dir="ltr" autoComplete="off" placeholder="Transaction ID · 64 نویسهٔ هگز" value={txHash} onChange={(event) => setTxHash(event.target.value.trim())} minLength={64} maxLength={64} pattern="[A-Fa-f0-9]{64}" required /></label>
          <p className="wallet-hint">هش transactions فقط پس از تأیید روی شبکه و تطبیق مبلغ و آدرس دریافت به اعتبار حساب وارد می‌شود. هر هش فقط یک‌بار قابل ثبت است.</p>
          {demo && <p className="wallet-hint">حالت نمونه فقط برای مشاهدهٔ ظاهر صفحه است؛ ثبت Deposit واقعی غیرفعال می‌باشد.</p>}
          {error && <p className="wallet-form-error" role="alert">{error}</p>}{message && <p className="wallet-form-success" role="status">{message}</p>}
          <button className="button-primary" type="submit" disabled={submitting || !session || !data?.deposit.address || !data.deposit.exchangeRateConfigured}>{submitting ? "Processing…" : "ارسال هش برای بررسی"}</button>
        </form>
      </section>
      <section className="panel wallet-video-panel wallet-deposit-guide"><span className="eyebrow">QUICK GUIDE</span><h2>آموزش Deposit</h2>{embedUrl ? <iframe src={embedUrl} title="آموزش Deposit به کیف پول GMO ARENA" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <div className="video-placeholder"><span aria-hidden="true">▶</span><strong>ویدیوی آموزش Deposit</strong><span>لینک YouTube یا Vimeo را در `NEXT_PUBLIC_DEPOSIT_GUIDE_VIDEO_URL` قرار بده.</span></div>}<ol className="deposit-steps"><li>شبکهٔ TRON و توکن USDT را انتخاب کن.</li><li>آدرس رسمی بالا را کپی و مبلغ را ارسال کن.</li><li>هش transactions را وارد کن تا شبکه بررسی شود.</li></ol></section>
    </section>}

    {activeTab === "withdraw" && <section className="panel wallet-form-panel wallet-withdraw-panel"><span className="eyebrow">WITHDRAW FUNDS</span><h2>درخواست Withdrawal GMO</h2><p className="subtle">درخواست پس از بررسی پشتیبانی پردازش می‌شود. مبالغ Pending از موجودی قابل‌Withdrawal کسر می‌شوند.</p><form className="deposit-form" onSubmit={submitWithdrawal}><label>مبلغ Withdrawal GMO<input inputMode="decimal" autoComplete="off" placeholder="مثلاً 100" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>آدرس مقصد ترون<input dir="ltr" autoComplete="off" placeholder="T…" value={withdrawAddress} onChange={(event) => setWithdrawAddress(event.target.value.trim())} minLength={34} maxLength={34} required /></label>{error && <p className="wallet-form-error" role="alert">{error}</p>}{message && <p className="wallet-form-success" role="status">{message}</p>}<button className="button-primary" type="submit" disabled={submitting || !session}>{submitting ? "در حال ثبت…" : "ثبت درخواست Withdrawal"}</button></form></section>}
  </main>;
}

export function HistoryRow({ item, onClick }: { item: HistoryItem; onClick: () => void }) {
  const positive = item.direction === "CREDIT";
  return <button className="wallet-history-row wallet-history-button" type="button" onClick={onClick}><span className={`wallet-history-icon wallet-icon-${item.type.toLowerCase()}`} aria-hidden="true">{positive ? "↓" : "↑"}</span><span className="wallet-history-description"><strong>{item.title || typeLabels[item.type] || item.type}</strong><small>{new Date(item.createdAt).toLocaleString("fa-IR")} · {item.reference ?? item.description}</small></span><span className="wallet-history-amount"><strong className={positive ? "wallet-credit" : "wallet-debit"}>{positive ? "+" : "−"}{formatAmount(item.amount)} {item.currency}</strong><span className={`wallet-status wallet-status-${item.status.toLowerCase()}`}>{statusLabels[item.status] ?? item.status}</span></span><span className="wallet-row-chevron" aria-hidden="true">‹</span></button>;
}
