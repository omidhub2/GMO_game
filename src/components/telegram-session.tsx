"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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

async function waitForTelegramWebApp(timeoutMs = 4000): Promise<TelegramWebApp | null> {
  const existing = getTelegramWebApp();
  if (existing?.initData) return existing;
  return new Promise(resolve => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const app = getTelegramWebApp();
      // Telegram may expose WebApp before its signed initData is populated.
      if (app?.initData || Date.now() - started >= timeoutMs) {
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
  const pathname = usePathname();

  useEffect(() => {
    // The public PWA install page must never trigger game sign-in. The user
    // chooses the Telegram bot explicitly from that page. 
    if (pathname === "/install") {
      emitStartup("gmo:startup-ready");
      return;
    }
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
        emitStartup("gmo:startup-error");
        return;
      }
      try {
        await signInWithTelegram();
        if (!cancelled) {
          emitStartup("gmo:startup-ready");
        }
      } catch {
        if (!cancelled) {
          console.warn("[telegram-session] automatic sign-in failed; user can reopen from the bot");
          emitStartup("gmo:startup-error");
        }
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [pathname]);

  return null;
}
