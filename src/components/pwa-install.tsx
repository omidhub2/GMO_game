"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type TelegramWebApp = {
  initData?: string;
  platform?: string;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
};

function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

const APP_URL = "https://gmo-arena.omidhub-ai.workers.dev";
const TELEGRAM_URL = "https://t.me/gmo_arenobot?start=login";
const INSTALL_URL = APP_URL + "/install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstall() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [inTelegram, setInTelegram] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installedBefore, setInstalledBefore] = useState(false);
  const [activeMatch, setActiveMatch] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const refreshMatch = useCallback(() => {
    try {
      const saved = window.sessionStorage.getItem("gmo-active-match");
      setActiveMatch(Boolean(saved));
    } catch {
      setActiveMatch(false);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }).catch(() => {});
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const telegramContext = Boolean(getTelegramWebApp()?.initData);
    setStandalone(isStandalone);
    setInTelegram(telegramContext);
    setVisible(true);
    try {
      if (isStandalone) window.localStorage.setItem("gmo-pwa-installed", "1");
      setInstalledBefore(window.localStorage.getItem("gmo-pwa-installed") === "1");
    } catch {}
    refreshMatch();

    const onMatchUpdate = () => refreshMatch();
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      try {
        window.localStorage.setItem("gmo-pwa-installed", "1");
        setInstalledBefore(true);
      } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshMatch();
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("gmo-match-updated", onMatchUpdate);
    window.addEventListener("pageshow", onMatchUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("gmo-match-updated", onMatchUpdate);
      window.removeEventListener("pageshow", onMatchUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshMatch]);

  function openTelegram() {
    const telegram = getTelegramWebApp() as unknown as TelegramWebApp | undefined;
    try {
      if (telegram?.openLink) telegram.openLink(TELEGRAM_URL, { try_instant_view: false });
      else window.location.assign(TELEGRAM_URL);
    } catch {
      window.location.assign(TELEGRAM_URL);
    }
  }

  function openInstallPage() {
    const telegram = getTelegramWebApp() as unknown as TelegramWebApp | undefined;
    try {
      if (telegram?.openLink) telegram.openLink(INSTALL_URL, { try_instant_view: false });
      else window.location.assign(INSTALL_URL);
    } catch {
      window.location.assign(INSTALL_URL);
    }
  }

  function openInstalledApp() {
    // The Telegram in-app browser cannot reliably read the PWA browser's
    // installation marker. Opening the canonical start URL gives Android/
    // the browser a chance to hand off to the installed web app; if it does
    // not, the user can continue in this Telegram Mini App.
    try {
      window.open(APP_URL + "/?launch=pwa", "_blank", "noopener,noreferrer");
    } catch {
      window.location.assign(APP_URL + "/?launch=pwa");
    }
  }

  async function installPwa() {
    if (!installPrompt || installing) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalledBefore(true);
        try { window.localStorage.setItem("gmo-pwa-installed", "1"); } catch {}
      }
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (pathname === "/install") return null;

  const showResume = activeMatch && pathname !== "/games/backgammon";

  return (
    <>
      {showResume && (
        <aside aria-label="ادامه مسابقه فعال" style={{ position: "fixed", zIndex: 151, insetInline: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxWidth: 520, marginInline: "auto", padding: 13, border: "1px solid #b7f34a", borderRadius: 14, background: "rgba(17,21,24,.98)", color: "#f1f5f3", boxShadow: "0 8px 32px #0009", direction: "rtl" }}>
          <strong style={{ display: "block", fontSize: 13 }}>مسابقه شما هنوز ادامه دارد</strong>
          <span style={{ display: "block", marginTop: 4, color: "#c5d0c9", fontSize: 11, lineHeight: 1.8 }}>می‌توانید به همان بازی و وضعیت قبلی برگردید.</span>
          <button type="button" onClick={() => window.location.assign("/games/backgammon?resume=1")} style={{ width: "100%", marginTop: 10, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
            ادامه مسابقه
          </button>
        </aside>
      )}

      {visible && !showResume && (
        <aside aria-label="ورود به GMO Arena" style={{ position: "fixed", zIndex: 150, insetInline: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxWidth: 520, marginInline: "auto", padding: 13, border: "1px solid #806b43", borderRadius: 14, background: "rgba(17,21,24,.97)", color: "#f1f5f3", boxShadow: "0 8px 32px #0009", direction: "rtl" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <img src="/icons/gmo-arena-192.svg" width="42" height="42" alt="" style={{ borderRadius: 10 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 13 }}>ورود به GMO Arena</strong>
              <span style={{ display: "block", marginTop: 3, color: "#aab6af", fontSize: 11, lineHeight: 1.8 }}>
                {inTelegram
                  ? "اگر GMO Arena را نصب کرده‌اید، بازکردن نسخه نصب‌شده را امتحان کنید؛ در غیر این صورت همین‌جا در تلگرام ادامه دهید."
                  : "برای ورود و احراز هویت، از ربات رسمی GMO Arena در تلگرام وارد شوید."}
              </span>
            </div>
            <button type="button" aria-label="بستن" onClick={() => setVisible(false)} style={{ border: "1px solid #394246", borderRadius: 8, padding: "7px 9px", background: "transparent", color: "#d8e0dc" }}>×</button>
          </div>

          {inTelegram ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={openInstalledApp} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
                تلاش برای بازکردن اپ نصب‌شده
              </button>
              <button type="button" onClick={() => setVisible(false)} style={{ flex: 1, border: "1px solid #52605a", borderRadius: 9, padding: "10px 12px", background: "#20282a", color: "#f1f5f3", fontWeight: 700 }}>
                ادامه بازی در تلگرام
              </button>
            </div>
          ) : (
            <>
              {installPrompt && !standalone && (
                <button type="button" disabled={installing} onClick={() => void installPwa()} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
                  {installing ? "در حال آماده‌سازی نصب..." : "نصب GMO Arena روی گوشی"}
                </button>
              )}
              <button type="button" onClick={openTelegram} style={{ width: "100%", marginTop: 8, border: "1px solid #52605a", borderRadius: 9, padding: "10px 12px", background: "#20282a", color: "#f1f5f3", fontWeight: 800 }}>
                ورود از طریق تلگرام
              </button>
              {!inTelegram && !standalone && !installPrompt && (
                <span style={{ display: "block", marginTop: 8, color: "#aab6af", fontSize: 10, lineHeight: 1.7 }}>
                  برای نصب، از منوی مرورگر گزینه Install app یا Add to Home Screen را انتخاب کن.
                </span>
              )}
            </>
          )}
          {standalone && <span style={{ display: "block", marginTop: 8, color: "#aab6af", fontSize: 10 }}>این نسخه نصب‌شده است؛ راهنمای نصب دیگری نمایش داده نمی‌شود.</span>}
        </aside>
      )}
    </>
  );
}
