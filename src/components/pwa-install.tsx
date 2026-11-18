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
    // Register/update the worker even when already launched as an installed PWA.
    // This ensures installed users receive the latest offline cache policy too.
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const telegramContext = Boolean(window.Telegram?.WebApp?.initData);
    setInTelegram(telegramContext);
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setBrowserPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function installHere() {
    if (!browserPrompt) return;
    await browserPrompt.prompt();
    const choice = await browserPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setAdded(true);
      setVisible(false);
    }
    setBrowserPrompt(null);
  }

  function openExternalForInstall() {
    const telegram = window.Telegram?.WebApp;
    try {
      if (telegram?.openLink) {
        telegram.openLink(APP_URL, { try_instant_view: false });
      } else {
        window.open(APP_URL, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(APP_URL, "_blank", "noopener,noreferrer");
    }
    setHelp(
      /iphone|ipad|ipod/i.test(navigator.userAgent) || telegram?.platform === "ios"
        ? "صفحه را در Safari باز کنید، Share را بزنید و Add to Home Screen را انتخاب کنید."
        : "صفحه را در Chrome باز کنید و از منو گزینه Install app یا Add to Home screen را انتخاب کنید."
    );
  }

  function showInstallInstructions() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      window.Telegram?.WebApp?.platform === "ios";
    setHelp(isIOS
      ? "برای نصب PWA مستقل، این آدرس را در Safari باز کنید؛ سپس Share و Add to Home Screen را بزنید."
      : "برای نصب PWA مستقل، این آدرس را در Chrome باز کنید؛ سپس Install app یا Add to Home screen را انتخاب کنید.");
  }

  if (!visible || added) return null;

  return (
    <aside aria-label="GMO Arena app installation" style={{ position: "fixed", zIndex: 150, insetInline: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxWidth: 520, marginInline: "auto", padding: 13, border: "1px solid #806b43", borderRadius: 14, background: "rgba(17,21,24,.97)", color: "#f1f5f3", boxShadow: "0 8px 32px #0009", direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <img src="/icons/gmo-arena-192.svg" width="42" height="42" alt="" style={{ borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 13 }}>اپلیکیشن GMO Arena</strong>
          <span style={{ display: "block", marginTop: 3, color: "#aab6af", fontSize: 11 }}>
            {inTelegram
              ? "بازی همین‌جا در تلگرام اجرا می‌شود؛ نصب PWA مستقل اختیاری است."
              : "نصب نسخه مستقل و اجرای بازی بدون نوار مرورگر"}
          </span>
        </div>
        <button type="button" aria-label="بستن" onClick={() => setVisible(false)} style={{ border: "1px solid #394246", borderRadius: 8, padding: "7px 9px", background: "transparent", color: "#d8e0dc" }}>×</button>
      </div>

      {inTelegram ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {browserPrompt ? (
            <button type="button" onClick={() => void installHere()} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
              نصب همین‌جا
            </button>
          ) : (
            <button type="button" onClick={() => setVisible(false)} style={{ flex: 1, border: "1px solid #52605a", borderRadius: 9, padding: "10px 12px", background: "#20282a", color: "#f1f5f3", fontWeight: 700 }}>
              ادامه بازی در تلگرام
            </button>
          )}
          <button type="button" onClick={openExternalForInstall} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
            نصب PWA مستقل
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {browserPrompt ? (
            <button type="button" onClick={() => void installHere()} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
              نصب اپلیکیشن
            </button>
          ) : (
            <button type="button" onClick={showInstallInstructions} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
              راهنمای نصب
            </button>
          )}
        </div>
      )}

      {help && <p role="status" style={{ margin: "10px 2px 0", color: "#f0d6a4", fontSize: 11, lineHeight: 1.8 }}>{help}</p>}
    </aside>
  );
}
