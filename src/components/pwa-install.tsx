"use client";

import { useEffect, useState } from "react";

type TelegramWebAppInstall = {
  initData?: string;
  platform?: string;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (callback: (status: string) => void) => void;
  onEvent?: (event: string, callback: (...args: unknown[]) => void) => void;
  offEvent?: (event: string, callback: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppInstall };
  }
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstall() {
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState("");
  const [telegramInstall, setTelegramInstall] = useState(false);
  const [browserPrompt, setBrowserPrompt] = useState<InstallPromptEvent | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone) return;
    const app = window.Telegram?.WebApp;
    const inTelegram = Boolean(app?.initData);
    setTelegramInstall(inTelegram && typeof app?.addToHomeScreen === "function");
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setBrowserPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    const onAdded = () => { setAdded(true); setVisible(false); };
    const onStatus = (...args: unknown[]) => {
      const status = typeof args[0] === "string" ? args[0] : "";
      if (status === "added") { setAdded(true); setVisible(false); }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    app?.onEvent?.("homeScreenAdded", onAdded);
    app?.onEvent?.("homeScreenChecked", onStatus);
    app?.checkHomeScreenStatus?.(status => {
      if (status === "added") { setAdded(true); setVisible(false); }
    });
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      app?.offEvent?.("homeScreenAdded", onAdded);
      app?.offEvent?.("homeScreenChecked", onStatus);
    };
  }, []);

  async function install() {
    const app = window.Telegram?.WebApp;
    if (app?.initData && typeof app.addToHomeScreen === "function") {
      try {
        app.addToHomeScreen();
        setHelp("درخواست افزودن GMO Arena به صفحه اصلی ارسال شد. اگر پیام نصب نمایش داده نشد، از منوی تلگرام یا مرورگر گزینه افزودن به صفحه اصلی را بررسی کنید.");
      } catch {
        setHelp("این نسخه تلگرام افزودن مستقیم را پشتیبانی نمی‌کند. از راهنمای نصب زیر استفاده کنید.");
      }
      return;
    }
    if (browserPrompt) {
      await browserPrompt.prompt();
      const choice = await browserPrompt.userChoice;
      if (choice.outcome === "accepted") { setAdded(true); setVisible(false); }
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHelp(isIOS
      ? "برای نصب در آیفون: این لینک را در Safari باز کنید، دکمه Share را بزنید و Add to Home Screen را انتخاب کنید."
      : "برای نصب در اندروید: منوی Chrome را باز کنید و Install app یا Add to Home screen را انتخاب کنید.");
  }

  if (!visible || added) return null;
  return (
    <aside aria-label="Install GMO Arena" style={{ position: "fixed", zIndex: 150, insetInline: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxWidth: 520, marginInline: "auto", padding: 13, border: "1px solid #806b43", borderRadius: 14, background: "rgba(17,21,24,.97)", color: "#f1f5f3", boxShadow: "0 8px 32px #0009", direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <img src="/icons/gmo-arena-192.svg" width="42" height="42" alt="" style={{ borderRadius: 10 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 13 }}>نصب GMO Arena</strong>
          <span style={{ display: "block", marginTop: 3, color: "#aab6af", fontSize: 11 }}>افزودن میان‌بر بازی به صفحه اصلی گوشی</span>
        </div>
        <button type="button" onClick={() => void install()} style={{ border: 0, borderRadius: 9, padding: "10px 13px", background: "#b7f34a", color: "#172207", fontWeight: 800, whiteSpace: "nowrap" }}>
          {telegramInstall ? "افزودن" : "نصب"}
        </button>
        <button type="button" aria-label="بستن" onClick={() => setVisible(false)} style={{ border: "1px solid #394246", borderRadius: 8, padding: "7px 9px", background: "transparent", color: "#d8e0dc" }}>×</button>
      </div>
      {help && <p role="status" style={{ margin: "10px 2px 0", color: "#f0d6a4", fontSize: 11, lineHeight: 1.8 }}>{help}</p>}
    </aside>
  );
}
