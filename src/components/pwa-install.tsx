"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  initData?: string;
  platform?: string;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const APP_URL = "https://gmo-arena.omidhub-ai.workers.dev";

export default function PwaInstall() {
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState("");
  const [inTelegram, setInTelegram] = useState(false);
  const [browserPrompt, setBrowserPrompt] = useState<InstallPromptEvent | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const telegram = window.Telegram?.WebApp;
    const telegramContext = Boolean(telegram?.initData);
    setInTelegram(telegramContext);
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setBrowserPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    // Telegram's addToHomeScreen creates a Telegram shortcut, not a standalone
    // browser-installed PWA. Hand the user off to the system browser instead.
    if (inTelegram) {
      const telegram = window.Telegram?.WebApp;
      setHelp(
        /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "مرورگر بیرونی باز می‌شود. برای نصب در آیفون، صفحه را در Safari باز کنید، Share را بزنید و Add to Home Screen را انتخاب کنید."
          : "مرورگر بیرونی باز می‌شود. در Chrome گزینه Install app یا Add to Home screen را انتخاب کنید تا نسخه مستقل GMO Arena نصب شود."
      );
      try {
        if (telegram?.openLink) {
          telegram.openLink(APP_URL, { try_instant_view: false });
        } else {
          window.open(APP_URL, "_blank", "noopener,noreferrer");
        }
      } catch {
        window.open(APP_URL, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (browserPrompt) {
      await browserPrompt.prompt();
      const choice = await browserPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setAdded(true);
        setVisible(false);
      }
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHelp(isIOS
      ? "برای نصب نسخه مستقل: این صفحه را در Safari باز کنید، Share را بزنید و Add to Home Screen را انتخاب کنید."
      : "برای نصب نسخه مستقل: منوی Chrome را باز کنید و Install app یا Add to Home screen را انتخاب کنید.");
  }

  if (!visible || added) return null;

  return (
    <aside aria-label="Install GMO Arena" style={{ position: "fixed", zIndex: 150, insetInline: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxWidth: 520, marginInline: "auto", padding: 13, border: "1px solid #806b43", borderRadius: 14, background: "rgba(17,21,24,.97)", color: "#f1f5f3", boxShadow: "0 8px 32px #0009", direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <img src="/icons/gmo-arena-192.svg" width="42" height="42" alt="" style={{ borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 13 }}>نصب اپلیکیشن مستقل GMO Arena</strong>
          <span style={{ display: "block", marginTop: 3, color: "#aab6af", fontSize: 11 }}>
            {inTelegram ? "باز کردن مرورگر برای نصب PWA واقعی" : "افزودن بازی به صفحه اصلی بدون نوار مرورگر"}
          </span>
        </div>
        <button type="button" onClick={() => void install()} style={{ border: 0, borderRadius: 9, padding: "10px 13px", background: "#b7f34a", color: "#172207", fontWeight: 800, whiteSpace: "nowrap" }}>
          {inTelegram ? "ادامه در مرورگر" : "نصب"}
        </button>
        <button type="button" aria-label="بستن" onClick={() => setVisible(false)} style={{ border: "1px solid #394246", borderRadius: 8, padding: "7px 9px", background: "transparent", color: "#d8e0dc" }}>×</button>
      </div>
      {help && <p role="status" style={{ margin: "10px 2px 0", color: "#f0d6a4", fontSize: 11, lineHeight: 1.8 }}>{help}</p>}
    </aside>
  );
}
