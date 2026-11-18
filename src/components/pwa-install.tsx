"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type TelegramWebApp = {
  initData?: string;
  platform?: string;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
};

const APP_URL = "https://gmo-arena.omidhub-ai.workers.dev";
const TELEGRAM_URL = "https://t.me/gmo_arenobot";

export default function PwaInstall() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [inTelegram, setInTelegram] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installedBefore, setInstalledBefore] = useState(false);
  const [activeMatch, setActiveMatch] = useState(false);

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
    const telegramContext = Boolean(window.Telegram?.WebApp?.initData);
    setStandalone(isStandalone);
    setInTelegram(telegramContext);
    setVisible(true);
    try {
      setInstalledBefore(window.localStorage.getItem("gmo-pwa-installed") === "1");
    } catch {}
    refreshMatch();

    const onMatchUpdate = () => refreshMatch();
    const onAppInstalled = () => {
      try {
        window.localStorage.setItem("gmo-pwa-installed", "1");
        setInstalledBefore(true);
      } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshMatch();
    };
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("gmo-match-updated", onMatchUpdate);
    window.addEventListener("pageshow", onMatchUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("gmo-match-updated", onMatchUpdate);
      window.removeEventListener("pageshow", onMatchUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshMatch]);

  function openTelegram() {
    const telegram = window.Telegram?.WebApp as unknown as TelegramWebApp | undefined;
    try {
      if (telegram?.openLink) telegram.openLink(TELEGRAM_URL, { try_instant_view: false });
      else window.location.assign(TELEGRAM_URL);
    } catch {
      window.location.assign(TELEGRAM_URL);
    }
  }

  function openInstalledApp() {
    const telegram = window.Telegram?.WebApp;
    try {
      if (telegram?.openLink) telegram.openLink(APP_URL, { try_instant_view: false });
      else window.open(APP_URL, "_blank", "noopener,noreferrer");
    } catch {
      window.open(APP_URL, "_blank", "noopener,noreferrer");
    }
  }

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
                  ? installedBefore
                    ? "نسخه نصب‌شده دارید؟ وارد اپلیکیشن شوید؛ یا همین‌جا در تلگرام بازی کنید."
                    : "برای بازی نیازی به نصب نیست؛ می‌توانید همین‌جا در تلگرام بازی کنید."
                  : "برای ورود و احراز هویت، از ربات رسمی GMO Arena در تلگرام وارد شوید."}
              </span>
            </div>
            <button type="button" aria-label="بستن" onClick={() => setVisible(false)} style={{ border: "1px solid #394246", borderRadius: 8, padding: "7px 9px", background: "transparent", color: "#d8e0dc" }}>×</button>
          </div>

          {inTelegram ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {installedBefore && (
                <button type="button" onClick={openInstalledApp} style={{ flex: 1, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
                  ورود به اپ نصب‌شده
                </button>
              )}
              <button type="button" onClick={() => setVisible(false)} style={{ flex: 1, border: "1px solid #52605a", borderRadius: 9, padding: "10px 12px", background: "#20282a", color: "#f1f5f3", fontWeight: 700 }}>
                بازی در تلگرام
              </button>
            </div>
          ) : (
            <button type="button" onClick={openTelegram} style={{ width: "100%", marginTop: 12, border: 0, borderRadius: 9, padding: "10px 12px", background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
              ورود از طریق تلگرام
            </button>
          )}
          {standalone && <span style={{ display: "block", marginTop: 8, color: "#aab6af", fontSize: 10 }}>این نسخه نصب‌شده است؛ راهنمای نصب دیگری نمایش داده نمی‌شود.</span>}
        </aside>
      )}
    </>
  );
}
