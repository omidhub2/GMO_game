"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallStage = "checking" | "ready" | "prompting" | "waiting" | "installed" | "manual";
const BOT_URL = "https://t.me/gmo_arenobot?start=login";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [stage, setStage] = useState<InstallStage>("checking");
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("android");
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const detectedPlatform = /iPad|iPhone|iPod/.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
    setPlatform(detectedPlatform);

    if (isStandalone()) {
      setStage("installed");
      return;
    }

    let fallbackTimer: number | undefined;
    let waitingTimer: number | undefined;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setStage("ready");
    };
    const onInstalled = () => {
      if (waitingTimer) window.clearTimeout(waitingTimer);
      setPrompt(null);
      setStage("installed");
      try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    fallbackTimer = window.setTimeout(() => {
      setStage(current => current === "checking" ? "manual" : current);
    }, 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (waitingTimer) window.clearTimeout(waitingTimer);
    };
  }, []);

  async function installApp() {
    if (!prompt || stage === "prompting" || stage === "waiting") return;
    setStage("prompting");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      if (choice.outcome === "accepted") {
        setStage("waiting");
        // Never invent an install percentage or report success before the
        // browser confirms installation with appinstalled.
        const timer = window.setTimeout(() => {
          setStage(current => current === "waiting" ? "manual" : current);
        }, 20000);
        const onInstalled = () => {
          window.clearTimeout(timer);
          setStage("installed");
          try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
          window.removeEventListener("appinstalled", onInstalled);
        };
        window.addEventListener("appinstalled", onInstalled);
      } else {
        setStage("ready");
      }
    } catch {
      setStage("manual");
    }
  }

  function confirmManualInstall() {
    setManualConfirmed(true);
    setStage("installed");
    try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
  }

  function openApp() {
    window.location.assign("/?launch=pwa");
  }

  function openBot() {
    window.location.assign(BOT_URL);
  }

  const complete = stage === "installed";
  const steps = [
    { title: "آماده‌سازی برنامه", detail: "بررسی سازگاری مرورگر و آماده‌سازی نصب", done: stage !== "checking" },
    { title: "تأیید نصب", detail: "تأیید درخواست در پنجره رسمی مرورگر", done: stage === "waiting" || complete },
    { title: "ساخت اپلیکیشن", detail: "افزوده‌شدن GMO Arena به صفحه اصلی", done: complete },
  ];
  const activeStep = stage === "checking" || stage === "ready" || stage === "manual" ? 0 : stage === "prompting" || stage === "waiting" ? 1 : 3;

  return (
    <main className="gmo-install-shell" dir="rtl">
      <style>{`
        .gmo-install-shell{--gold:#e7c77e;--lime:#c4f15c;min-height:100dvh;display:grid;place-items:center;position:relative;overflow:hidden;padding:24px 16px 40px;color:#f6f0df;background:radial-gradient(ellipse at 50% 18%,#a17b302b,transparent 42%),radial-gradient(ellipse at 50% 100%,#b7f34a0c,transparent 44%),#090b0d}
        .gmo-install-card{position:relative;z-index:1;width:100%;max-width:460px;padding:30px 24px 24px;border:1px solid #806b43;border-radius:28px;background:linear-gradient(155deg,#1b2020f5,#101414f7);box-shadow:0 24px 90px #000b;text-align:center}
        .gmo-install-logo{width:100px;height:100px;object-fit:contain;filter:drop-shadow(0 10px 28px #c59a4a55);animation:gmo-install-float 3s ease-in-out infinite}
        .gmo-install-kicker{margin-top:8px;color:var(--gold);font-size:10px;font-weight:900;letter-spacing:4px}
        .gmo-install-title{font-size:27px;font-weight:950;margin:14px 0 8px}
        .gmo-install-sub{margin:0 auto 24px;max-width:340px;color:#b9b6a9;font-size:13px;line-height:2}
        .gmo-install-steps{display:grid;gap:13px;text-align:right;margin:24px 0}
        .gmo-install-step{display:flex;align-items:center;gap:12px;opacity:.48;transition:opacity .25s ease}
        .gmo-install-step.active,.gmo-install-step.done{opacity:1}
        .gmo-install-step-icon{width:34px;height:34px;display:grid;place-items:center;flex:none;border:1px solid #63543a;border-radius:50%;color:#b7a071;background:#171b19;font-weight:900}
        .gmo-install-step.done .gmo-install-step-icon{background:#b7f34a1c;border-color:#b7f34a;color:var(--lime)}
        .gmo-install-step.active .gmo-install-step-icon{border-color:var(--gold);color:var(--gold);box-shadow:0 0 18px #d9b76f24}
        .gmo-install-step-title{font-size:12px;font-weight:850;color:#f2e8d0}
        .gmo-install-step-detail{font-size:10px;color:#9e9d91;margin-top:3px}
        .gmo-install-track{height:7px;border-radius:20px;background:#34352d;overflow:hidden;margin-top:22px}
        .gmo-install-track-fill{height:100%;border-radius:20px;background:linear-gradient(90deg,#9abf42,#e4d28c);transition:width .45s ease}
        .gmo-install-primary{width:100%;border:0;border-radius:14px;padding:15px 16px;margin-top:10px;background:linear-gradient(110deg,#b7e94c,#d8f58b);color:#172207;font-size:14px;font-weight:950;box-shadow:0 8px 28px #b7f34a20}
        .gmo-install-primary:disabled{opacity:.65}
        .gmo-install-secondary{width:100%;border:1px solid #806b43;border-radius:13px;padding:13px;margin-top:10px;background:#29251c;color:#f4d58d;font-weight:850}
        .gmo-install-note{font-size:10px;color:#898b81;line-height:1.9;margin:18px 4px 0}
        .gmo-install-manual{padding:14px;text-align:right;border:1px solid #ffffff18;border-radius:15px;background:#ffffff08;color:#d7d1c0;font-size:12px;line-height:2}
        .gmo-install-manual ol{padding-right:20px;margin:6px 0}
        .gmo-install-success{padding:15px;border:1px solid #b7f34a66;border-radius:15px;background:#b7f34a14;color:#d4f99c;font-weight:850}
        .gmo-install-orb{position:absolute;width:220px;height:220px;border-radius:50%;filter:blur(80px);background:#a17b301c;pointer-events:none}
        .gmo-install-orb.one{top:4%;right:-100px}.gmo-install-orb.two{bottom:2%;left:-110px;background:#b7f34a0c}
        @keyframes gmo-install-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @media(prefers-reduced-motion:reduce){.gmo-install-logo{animation:none}.gmo-install-step,.gmo-install-track-fill{transition:none}}
      `}</style>
      <div className="gmo-install-orb one" /><div className="gmo-install-orb two" />
      <section className="gmo-install-card" aria-live="polite">
        <img src="/icons/gmo-arena-512.svg" alt="GMO Arena" className="gmo-install-logo" />
        <div className="gmo-install-kicker">PLAY · COMPETE · WIN</div>
        <h1 className="gmo-install-title">{complete ? "نصب با موفقیت انجام شد!" : stage === "waiting" ? "در حال تکمیل نصب..." : stage === "prompting" ? "درخواست نصب ارسال شد" : "GMO Arena را نصب کن"}</h1>
        <p className="gmo-install-sub">
          {complete ? "آیکون GMO Arena آماده است. حالا می‌توانی وارد میدان بازی شوی." :
            stage === "waiting" ? "در انتظار تأیید نهایی مرورگر هستیم. لطفاً پنجره نصب را کامل کن." :
            stage === "prompting" ? "پنجره رسمی نصب مرورگر را تأیید کن." :
            "بازی را به صفحه اصلی گوشی اضافه کن و مثل یک اپلیکیشن مستقل وارد میدان شو."}
        </p>

        <div className="gmo-install-steps">
          {steps.map((step, index) => (
            <div key={step.title} className={`gmo-install-step ${step.done ? "done" : activeStep === index ? "active" : ""}`}>
              <div className="gmo-install-step-icon">{step.done ? "✓" : index + 1}</div>
              <div><div className="gmo-install-step-title">{step.title}</div><div className="gmo-install-step-detail">{step.detail}</div></div>
            </div>
          ))}
        </div>
        <div className="gmo-install-track" aria-label="پیشرفت مرحله‌ای نصب">
          <div className="gmo-install-track-fill" style={{ width: complete ? "100%" : stage === "waiting" ? "68%" : stage === "prompting" ? "48%" : stage === "ready" || stage === "manual" ? "30%" : "12%" }} />
        </div>

        {complete ? (
          <div className="gmo-install-success" style={{ marginTop: 18 }}>
            ✓ نصب تأیید شد
            <button className="gmo-install-primary" onClick={openApp}>ورود به GMO Arena ←</button>
          </div>
        ) : prompt ? (
          <button className="gmo-install-primary" disabled={stage === "prompting" || stage === "waiting"} onClick={() => void installApp()}>
            {stage === "prompting" ? "در حال بازکردن پنجره نصب..." : stage === "waiting" ? "در انتظار تکمیل نصب..." : "⬇ نصب GMO Arena"}
          </button>
        ) : (
          <div className="gmo-install-manual">
            <strong style={{ color: "#e8c77e" }}>{platform === "ios" ? "مراحل نصب در آیفون" : platform === "android" ? "مراحل نصب در اندروید" : "مراحل نصب از مرورگر"}</strong>
            {platform === "ios" ? (
              <ol><li>صفحه را در Safari باز کن.</li><li>دکمه Share را بزن.</li><li>Add to Home Screen و سپس Add را انتخاب کن.</li></ol>
            ) : platform === "android" ? (
              <ol><li>منوی سه‌نقطه Chrome را باز کن.</li><li>Install app یا Add to Home screen را انتخاب کن.</li><li>در پنجره مرورگر، نصب را تأیید کن.</li></ol>
            ) : (
              <ol><li>منوی مرورگر را باز کن.</li><li>Install app یا گزینه نصب این سایت را انتخاب کن.</li><li>درخواست نصب را تأیید کن.</li></ol>
            )}
            {stage === "waiting" && <p>اگر مرورگر نصب را تأیید کرد اما پیام تکمیل نیامد، برنامه را از آیکون صفحه اصلی باز کن.</p>}
            <button className="gmo-install-secondary" onClick={confirmManualInstall}>آیکون برنامه را اضافه کردم</button>
            {manualConfirmed && <button className="gmo-install-primary" onClick={openApp}>ورود به GMO Arena</button>}
          </div>
        )}

        <button className="gmo-install-secondary" onClick={() => setShowTelegramDialog(true)}>ورود از طریق ربات تلگرام</button>
        <p className="gmo-install-note">این صفحه برای نصب عمومی است و به ورود یا ثبت‌نام نیاز ندارد. ورود به حساب بازی از طریق ربات رسمی تلگرام انجام می‌شود.</p>
      </section>

      {showTelegramDialog && (
        <div role="presentation" onClick={() => setShowTelegramDialog(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 22, background: "#000b", backdropFilter: "blur(8px)" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="telegram-login-title" onClick={event => event.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 23, border: "1px solid #b99a5d", borderRadius: 22, background: "#171c1b", color: "#f6f0df", textAlign: "center" }}>
            <img src="/icons/gmo-arena-192.svg" alt="" width="66" height="66" style={{ margin: "0 auto 12px" }} />
            <h2 id="telegram-login-title" style={{ fontSize: 19, margin: "0 0 9px" }}>ورود از طریق ربات تلگرام</h2>
            <p style={{ color: "#c0c0b5", fontSize: 12, lineHeight: 2 }}>با زدن دکمه زیر وارد ربات رسمی GMO Arena می‌شوی. ربات پیام تصویری بازی و دکمه ورود را برایت می‌فرستد.</p>
            <button onClick={openBot} style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, marginTop: 12, background: "#b7f34a", color: "#172207", fontWeight: 900 }}>رفتن به ربات GMO Arena</button>
            <button onClick={() => setShowTelegramDialog(false)} style={{ width: "100%", border: "1px solid #59605a", borderRadius: 12, padding: 12, marginTop: 9, background: "transparent", color: "#d7d8d0" }}>بازگشت</button>
          </section>
        </div>
      )}
    </main>
  );
}
