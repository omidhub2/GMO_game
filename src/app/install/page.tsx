"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const BOT_URL = "https://t.me/gmo_arenobot?start=game_login";

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      try { localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") {
        // appinstalled is the authoritative completion signal.
        setInstalling(false);
      }
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  }

  function openBot() {
    window.location.assign(BOT_URL);
  }

  return (
    <main dir="rtl" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 22, color: "#f6f0df", background: "radial-gradient(ellipse at 50% 25%, #9d782b33, transparent 42%), #090b0d" }}>
      <section style={{ width: "100%", maxWidth: 440, padding: "30px 24px", border: "1px solid #806b43", borderRadius: 26, background: "linear-gradient(160deg,#1b2020,#101414)", boxShadow: "0 24px 80px #0009", textAlign: "center" }}>
        <img src="/icons/gmo-arena-512.svg" alt="GMO Arena" width="112" height="112" style={{ objectFit: "contain", margin: "0 auto 12px", filter: "drop-shadow(0 10px 25px #c59a4a44)" }} />
        <div style={{ color: "#d9b76f", fontSize: 10, fontWeight: 900, letterSpacing: 4 }}>PLAY · COMPETE · WIN</div>
        <h1 style={{ fontSize: 27, margin: "13px 0 8px", fontWeight: 950 }}>{installed ? "GMO Arena آماده است!" : "GMO Arena را نصب کن"}</h1>
        <p style={{ color: "#b9b6a9", fontSize: 13, lineHeight: 2, margin: "0 0 22px" }}>
          {installed ? "برای ورود امن به بازی، از ربات رسمی تلگرام دکمه ورود به بازی را دریافت کن." : "بازی را مثل یک اپلیکیشن مستقل به گوشی اضافه کن؛ سپس از ربات تلگرام وارد حساب خودت شو."}
        </p>

        {!installed && prompt && (
          <button onClick={() => void installApp()} disabled={installing} style={{ width: "100%", border: 0, borderRadius: 13, padding: 15, background: "#c4f15c", color: "#172207", fontWeight: 900, fontSize: 15 }}>
            {installing ? "در حال بازکردن مراحل نصب..." : "⬇ نصب GMO Arena"}
          </button>
        )}

        {!installed && !prompt && (
          <div style={{ textAlign: "right", borderRadius: 14, background: "#ffffff0a", border: "1px solid #ffffff16", padding: 14, color: "#d7d1c0", fontSize: 12, lineHeight: 2 }}>
            <strong style={{ color: "#e8c77e" }}>{ios ? "نصب در آیفون" : "نصب در گوشی"}</strong>
            {ios ? <p>در Safari گزینه Share و سپس Add to Home Screen را انتخاب کن.</p> : <p>در Chrome منوی سه‌نقطه را باز کن و Install app یا Add to Home Screen را بزن.</p>}
          </div>
        )}

        {installed && (
          <div style={{ padding: 13, borderRadius: 12, background: "#b7f34a18", border: "1px solid #b7f34a66", color: "#c9f68a", fontWeight: 800, marginBottom: 14 }}>
            ✓ نصب انجام شد. حالا از ربات وارد بازی شو.
          </div>
        )}

        <button onClick={() => setShowTelegramDialog(true)} style={{ width: "100%", marginTop: 14, border: "1px solid #b99a5d", borderRadius: 13, padding: 15, background: "#29251c", color: "#f4d58d", fontWeight: 900, fontSize: 14 }}>
          ورود از طریق ربات تلگرام
        </button>
        <p style={{ color: "#85877f", fontSize: 10, lineHeight: 1.8, marginTop: 16 }}>
          ورود به بازی فقط با پیام امن ربات GMO Arena انجام می‌شود؛ این صفحه نیازی به ورود یا ثبت‌نام ندارد.
        </p>
      </section>

      {showTelegramDialog && (
        <div role="presentation" onClick={() => setShowTelegramDialog(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 22, background: "#000b", backdropFilter: "blur(8px)" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="telegram-login-title" onClick={event => event.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 23, border: "1px solid #b99a5d", borderRadius: 22, background: "#171c1b", color: "#f6f0df", textAlign: "center" }}>
            <img src="/icons/gmo-arena-192.svg" alt="" width="66" height="66" style={{ margin: "0 auto 12px" }} />
            <h2 id="telegram-login-title" style={{ fontSize: 19, margin: "0 0 9px" }}>ورود از طریق ربات تلگرام</h2>
            <p style={{ color: "#c0c0b5", fontSize: 12, lineHeight: 2 }}>با زدن دکمه زیر وارد ربات رسمی GMO Arena می‌شوی. ربات یک پیام تصویری با بنر بازی و دکمه «ورود به بازی» برایت می‌فرستد. روی همان دکمه بزن تا بازی در اپلیکیشن باز شود.</p>
            <button onClick={openBot} style={{ width: "100%", border: 0, borderRadius: 12, padding: 14, marginTop: 12, background: "#b7f34a", color: "#172207", fontWeight: 900 }}>رفتن به ربات GMO Arena</button>
            <button onClick={() => setShowTelegramDialog(false)} style={{ width: "100%", border: "1px solid #59605a", borderRadius: 12, padding: 12, marginTop: 9, background: "transparent", color: "#d7d8d0" }}>بازگشت</button>
          </section>
        </div>
      )}
    </main>
  );
}
