"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
type Stage = "checking" | "ready" | "prompting" | "waiting" | "installed" | "manual";
const BOT_URL = "https://t.me/gmo_arenobot?start=game_login";

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [manualAcknowledged, setManualAcknowledged] = useState(false);
  const [telegramDialog, setTelegramDialog] = useState(false);

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    if (standalone()) {
      setStage("installed");
      return;
    }
    let fallback: number | undefined;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setStage("ready");
      if (fallback) window.clearTimeout(fallback);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setStage("installed");
      try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    fallback = window.setTimeout(() => setStage(current => current === "checking" ? "manual" : current), 2200);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (fallback) window.clearTimeout(fallback);
    };
  }, []);

  async function install() {
    if (!installPrompt || stage === "prompting" || stage === "waiting") return;
    setStage("prompting");
    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      setInstallPrompt(null);
      setStage(current => current === "installed" ? "installed" : result.outcome === "accepted" ? "waiting" : "ready");
    } catch {
      setStage("manual");
    }
  }

  const step = stage === "installed" ? 3 : stage === "waiting" ? 2 : stage === "prompting" ? 1 : stage === "ready" ? 1 : 0;
  const progress = stage === "installed" ? "100%" : stage === "waiting" || stage === "prompting" ? "38%" : stage === "ready" ? "34%" : "12%";
  const title = stage === "installed" ? "نصب با موفقیت انجام شد!" : stage === "waiting" ? "در حال تکمیل نصب..." : stage === "prompting" ? "درخواست نصب ارسال شد" : "GMO Arena را نصب کن";
  const subtitle = stage === "installed" ? "اپلیکیشن آماده است؛ وارد میدان بازی شو." : stage === "waiting" ? "درخواست نصب پذیرفته شد؛ منتظریم سیستم‌عامل نصب را کامل کند." : "بازی را مثل یک اپلیکیشن مستقل به گوشی اضافه کن.";

  return (
    <main className="gmo-install-page" dir="rtl">
      <style>{".gmo-install-page{min-height:100dvh;display:grid;place-items:center;padding:24px 16px 44px;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 15%,#a77c3033,transparent 45%),#090c0b;color:#f6f0df}.gmo-install-card{width:100%;max-width:460px;padding:28px 23px;border:1px solid #806b43;border-radius:28px;background:linear-gradient(155deg,#1c2220,#101513);box-shadow:0 28px 90px #000b;text-align:center}.gmo-install-logo{width:104px;height:104px;object-fit:contain;filter:drop-shadow(0 10px 28px #c59a4a55);animation:gmo-float 3s ease-in-out infinite}.gmo-install-title{font-size:25px;font-weight:950;margin:13px 0 6px}.gmo-install-sub{font-size:12px;color:#b9b6a9;line-height:2;margin:0 auto 22px}.gmo-install-track{height:7px;background:#34382f;border-radius:99px;overflow:hidden;margin-bottom:12px}.gmo-install-track span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#9a773c,#e5c879,#c4f15c);transition:width .5s}.gmo-install-track.waiting span{width:34%!important;animation:gmo-indeterminate 1.25s ease-in-out infinite}.gmo-install-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:22px}.gmo-install-step{font-size:10px;color:#777d72;line-height:1.7}.gmo-install-step.active{color:#e8ce91}.gmo-install-step.done{color:#b7f34a}.gmo-install-dot{width:24px;height:24px;border:1px solid #55594b;border-radius:50%;display:grid;place-items:center;margin:0 auto 5px}.gmo-install-primary{width:100%;border:0;border-radius:13px;padding:15px;background:linear-gradient(100deg,#b7e94d,#d5f77e);color:#172207;font-weight:950;font-size:14px}.gmo-install-secondary{width:100%;margin-top:10px;border:1px solid #65583d;border-radius:12px;padding:12px;background:#25271f;color:#e8d5a7;font-weight:800}.gmo-install-manual{padding:15px;text-align:right;border:1px solid #ffffff1c;border-radius:15px;background:#ffffff08;color:#d7d1c0;font-size:12px;line-height:2}.gmo-install-manual ol{padding-right:20px}.gmo-install-success{padding:14px;border-radius:14px;background:#b7f34a16;border:1px solid #b7f34a66;color:#d4f89a;font-size:13px;font-weight:850;margin-bottom:13px}.gmo-install-foot{color:#85877f;font-size:10px;line-height:1.9;margin-top:17px}@keyframes gmo-indeterminate{0%{transform:translateX(140%)}100%{transform:translateX(-340%)}}@keyframes gmo-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@media(prefers-reduced-motion:reduce){.gmo-install-logo,.gmo-install-track.waiting span{animation:none}}"}
      </style>
      <section className="gmo-install-card" aria-live="polite">
        <img src="/icons/gmo-arena-512.svg" alt="GMO Arena" className="gmo-install-logo" />
        <div style={{ color: "#d9b76f", fontSize: 10, fontWeight: 900, letterSpacing: 4, marginTop: 10 }}>PLAY · COMPETE · WIN</div>
        <h1 className="gmo-install-title">{title}</h1>
        <p className="gmo-install-sub">{subtitle}</p>
        <div className={"gmo-install-track" + (stage === "waiting" || stage === "prompting" ? " waiting" : "")}>
          <span style={{ width: progress }} />
        </div>
        <div className="gmo-install-steps">
          {["آماده‌سازی", "تأیید مرورگر", "تکمیل نصب"].map((label, index) => (
            <div key={label} className={"gmo-install-step" + (step > index ? " done" : step === index ? " active" : "")}>
              <div className="gmo-install-dot">{step > index ? "✓" : index + 1}</div>
              <strong>{label}</strong>
            </div>
          ))}
        </div>

        {stage === "installed" ? (
          <>
            <div className="gmo-install-success">✓ نصب با موفقیت انجام شد؛ GMO Arena آماده اجراست.</div>
            <button className="gmo-install-primary" onClick={() => window.location.assign("/")}>ورود به اپلیکیشن ←</button>
          </>
        ) : stage === "ready" || stage === "prompting" ? (
          <button className="gmo-install-primary" disabled={stage === "prompting"} onClick={() => void install()}>
            {stage === "prompting" ? "در انتظار پنجره نصب مرورگر..." : "⬇ نصب GMO Arena روی گوشی"}
          </button>
        ) : stage === "waiting" ? (
          <>
            <div className="gmo-install-success" style={{ background: "#d9b76f12", borderColor: "#d9b76f55", color: "#e8ce91" }}>درخواست نصب تأیید شد؛ تکمیل نصب را از سیستم‌عامل انتظار می‌کشیم.</div>
            <button className="gmo-install-secondary" onClick={() => setStage("manual")}>نمایش راهنمای نصب دستی</button>
          </>
        ) : (
          <div className="gmo-install-manual">
            <strong style={{ color: "#e8c77e" }}>{ios ? "نصب در آیفون و آیپد" : "نصب در اندروید"}</strong>
            {ios ? <ol><li>صفحه را در Safari باز کن.</li><li>دکمه Share را بزن.</li><li>Add to Home Screen و سپس Add را انتخاب کن.</li></ol> : <ol><li>منوی سه‌نقطه Chrome را باز کن.</li><li>Install app یا Add to Home screen را انتخاب کن.</li><li>نصب را در پنجره مرورگر تأیید کن.</li></ol>}
            <button className="gmo-install-secondary" onClick={() => setManualAcknowledged(true)}>{manualAcknowledged ? "راهنما انجام شد؛ آیکون را بررسی کن" : "مراحل را انجام دادم"}</button>
            {manualAcknowledged && <p style={{ color: "#c9f68a" }}>اگر آیکون GMO Arena به صفحه اصلی اضافه شده، آن را باز کن. نصب دستی از این مرورگر قابل تأیید خودکار نیست.</p>}
          </div>
        )}

        <button className="gmo-install-secondary" onClick={() => setTelegramDialog(true)}>ورود از طریق ربات تلگرام</button>
        <p className="gmo-install-foot">این صفحه برای نصب عمومی است و نیازی به ورود ندارد. ورود به حساب بازی از طریق ربات رسمی تلگرام انجام می‌شود.</p>
      </section>

      {telegramDialog && (
        <div role="presentation" onClick={() => setTelegramDialog(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 22, background: "#000c", backdropFilter: "blur(8px)" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="telegram-login-title" onClick={event => event.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 23, border: "1px solid #b99a5d", borderRadius: 22, background: "#171c1b", color: "#f6f0df", textAlign: "center" }}>
            <img src="/icons/gmo-arena-192.svg" alt="" width="66" height="66" style={{ margin: "0 auto 12px" }} />
            <h2 id="telegram-login-title">ورود از طریق ربات تلگرام</h2>
            <p style={{ color: "#c0c0b5", fontSize: 12, lineHeight: 2 }}>ربات رسمی GMO Arena پیام تصویری بازی و دکمه ورود را برایت می‌فرستد.</p>
            <button className="gmo-install-primary" onClick={() => window.location.assign(BOT_URL)}>رفتن به ربات GMO Arena</button>
            <button className="gmo-install-secondary" onClick={() => setTelegramDialog(false)}>بازگشت</button>
          </section>
        </div>
      )}
    </main>
  );
}
