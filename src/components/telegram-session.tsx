"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

let pendingLogin: Promise<void> | null = null;

function emitStartup(name: "gmo:startup-ready" | "gmo:startup-error") {
  window.dispatchEvent(new Event(name));
}

async function waitForTelegramWebApp(timeoutMs = 2500): Promise<TelegramWebApp | null> {
  const existing = getTelegramWebApp();
  if (existing) return existing;
  return new Promise(resolve => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const app = getTelegramWebApp();
      if (app || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(app ?? null);
      }
    }, 100);
  });
}

export function signInWithTelegram() {
  if (pendingLogin) return pendingLogin;
  pendingLogin = (async () => {
    const app = await waitForTelegramWebApp();
    if (!app?.initData) throw new Error("اطلاعات ورود تلگرام دریافت نشد. برنامه را از ربات GMO Arena باز کن.");
    const response = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ initData: app.initData }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "ورود تلگرام انجام نشد.");
    window.dispatchEvent(new Event("gmo:session-changed"));
  })().finally(() => { pendingLogin = null; });
  return pendingLogin;
}

export default function TelegramSession() {
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      const app = await waitForTelegramWebApp();
      if (cancelled) return;
      if (!app) {
        // A normal browser/PWA launch is allowed to show the public shell.
        emitStartup("gmo:startup-ready");
        return;
      }
      app.ready?.();
      app.expand?.();
      if (!app.initData) {
        const message = "اطلاعات امن تلگرام در دسترس نیست. لطفاً GMO Arena را از دکمه ربات باز کن.";
        setError(message);
        emitStartup("gmo:startup-error");
        return;
      }
      try {
        await signInWithTelegram();
        if (!cancelled) {
          setError("");
          emitStartup("gmo:startup-ready");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "ورود تلگرام ناموفق بود.");
          emitStartup("gmo:startup-error");
        }
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  async function retry() {
    setRetrying(true);
    setError("");
    try {
      await signInWithTelegram();
      setError("");
      emitStartup("gmo:startup-ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ورود تلگرام ناموفق بود.");
      emitStartup("gmo:startup-error");
    } finally {
      setRetrying(false);
    }
  }

  if (!error) return null;
  return (
    <div role="alert" style={{ position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 12000, padding: 16, background: "#172332", color: "#fff", border: "1px solid #f5c46b", borderRadius: 14, direction: "rtl" }}>
      <strong style={{ display: "block", marginBottom: 6 }}>ورود تلگرام انجام نشد</strong>
      <span>{error}</span>
      <button type="button" disabled={retrying} onClick={() => void retry()} style={{ display: "block", marginTop: 12, padding: "10px 14px", borderRadius: 9, border: 0, background: "#b7f34a", color: "#172207", fontWeight: 800 }}>
        {retrying ? "در حال اتصال..." : "تلاش دوباره"}
      </button>
    </div>
  );
}
