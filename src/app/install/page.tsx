"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallStage = "checking" | "ready" | "prompting" | "accepted" | "installed" | "manual";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallPage() {
  const [stage, setStage] = useState<InstallStage>("checking");
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState("android");
  const [manualConfirmed, setManualConfirmed] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPad|iPhone|iPod/.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "desktop");

    if (isStandalone()) {
      setStage("installed");
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setStage("ready");
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setStage("installed");
      try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Give Chromium time to dispatch beforeinstallprompt. Safari/iOS uses
    // the browser's Share > Add to Home Screen flow instead.
    const fallback = window.setTimeout(() => {
      setStage(current => current === "checking" ? "manual" : current);
    }, 1800);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(fallback);
    };
  }, []);

  async function install() {
    if (!promptEvent || stage === "prompting") return;
    setStage("prompting");
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "accepted") {
        // The browser does not expose a real percentage. Wait for appinstalled
        // rather than showing a fabricated progress value.
        setStage(current => current === "installed" ? "installed" : "accepted");
      } else {
        setStage("ready");
      }
    } catch {
      setStage("manual");
    }
  }

  function openApp() {
    window.location.assign("/");
  }

  const progress = stage === "installed" ? 100 : stage === "accepted" ? 85 : stage === "prompting" ? 62 : stage === "ready" ? 38 : stage === "manual" ? 24 : 12;
  const heading = stage === "installed" ? "نصب با موفقیت انجام شد!" :
    stage === "accepted" ? "در حال تکمیل نصب..." :
    stage === "prompting" ? "در حال بازکردن پنجره نصب..." :
    "GMO Arena را نصب کن";
  const description = stage === "installed"
    ? "آماده‌ای؟ وارد میدان شو و بازی را ادامه بده."
    : stage === "accepted"
      ? "درخواست نصب تأیید شد. اگر آیکون برنامه روی صفحه گوشی ظاهر شد، وارد آن شو."
      : "یک‌بار نصب کن و هر بار سریع، تمام‌صفحه و مثل یک اپلیکیشن وارد بازی شو.";

  return (
    <main className="gmo-install-page" dir="rtl">
      <div className="gmo-install-orb gmo-install-orb-one" />
      <div className="gmo-install-orb gmo-install-orb-two" />
      <section className="gmo-install-card" aria-live="polite">
        <div className="gmo-install-logo-wrap">
          <img src="/icons/gmo-arena-512.svg" alt="GMO Arena" className="gmo-install-logo" />
          <span className="gmo-install-logo-ring" />
        </div>
        <div className="gmo-install-eyebrow">PLAY · COMPETE · WIN</div>
        <h1>{heading}</h1>
        <p className="gmo-install-description">{description}</p>

        <div className="gmo-install-progress" aria-label="مراحل آماده‌سازی نصب">
          <div className="gmo-install-progress-track"><span style={{ width: progress + "%" }} /></div>
          <div className="gmo-install-progress-labels">
            <span className={progress >= 24 ? "active" : ""}>آماده‌سازی</span>
            <span className={progress >= 62 ? "active" : ""}>تأیید نصب</span>
            <span className={progress === 100 ? "active" : ""}>آماده بازی</span>
          </div>
        </div>

        {stage === "installed" ? (
          <button className="gmo-install-primary" onClick={openApp}>ورود به اپلیکیشن <span>←</span></button>
        ) : stage === "ready" || stage === "prompting" ? (
          <button className="gmo-install-primary" disabled={stage === "prompting"} onClick={() => void install()}>
            {stage === "prompting" ? "در انتظار تأیید مرورگر..." : "نصب GMO Arena روی گوشی"}
            <span>↓</span>
          </button>
        ) : stage === "accepted" ? (
          <button className="gmo-install-primary" onClick={openApp}>باز کردن GMO Arena <span>←</span></button>
        ) : (
          <div className="gmo-install-manual">
            {platform === "ios" ? (
              <>
                <strong>نصب در آیفون و آیپد</strong>
                <ol><li>در Safari دکمه Share را بزن.</li><li>گزینه Add to Home Screen را انتخاب کن.</li><li>روی Add بزن تا آیکون به صفحه اصلی اضافه شود.</li></ol>
              </>
            ) : platform === "android" ? (
              <>
                <strong>نصب در اندروید</strong>
                <ol><li>منوی سه‌نقطه Chrome را باز کن.</li><li>Install app یا Add to Home screen را انتخاب کن.</li><li>نصب را تأیید کن و منتظر ظاهرشدن آیکون بمان.</li></ol>
              </>
            ) : (
              <>
                <strong>نصب از مرورگر</strong>
                <ol><li>منوی مرورگر را باز کن.</li><li>Install app یا گزینه نصب این سایت را انتخاب کن.</li><li>در پنجره مرورگر نصب را تأیید کن.</li></ol>
              </>
            )}
            <button className="gmo-install-secondary" onClick={() => setManualConfirmed(true)}>
              {manualConfirmed ? "پس از نصب، آیکون GMO Arena را باز کن" : "مراحل را دیدم"}
            </button>
            {manualConfirmed && <button className="gmo-install-primary" onClick={openApp}>ورود به GMO Arena <span>←</span></button>}
          </div>
        )}

        <div className="gmo-install-footnote">
          {stage === "installed"
            ? "نصب انجام شد؛ برای ورود به بازی از اپلیکیشن استفاده کن."
            : "نصب رایگان است و اطلاعات بازی پس از ورود امن از طریق تلگرام بارگذاری می‌شود."}
        </div>
      </section>
      <div className="gmo-install-bottom">GMO ARENA <span>•</span> YOUR GAME. YOUR ARENA.</div>
    </main>
  );
}
