"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: { WebApp: { initData: string; ready: () => void; expand: () => void } };
  }
}

let pendingLogin: Promise<void> | null = null;

export function signInWithTelegram() {
  if (pendingLogin) return pendingLogin;
  pendingLogin = (async () => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) throw new Error("Open GMO Arena from the Telegram bot to sign in.");
    const response = await fetch("/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Telegram sign-in failed.");
    window.dispatchEvent(new Event("gmo:session-changed"));
  })().finally(() => { pendingLogin = null; });
  return pendingLogin;
}

export default function TelegramSession() {
  const [error, setError] = useState("");
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) return;
    app.ready();
    app.expand();
    void signInWithTelegram().catch(cause => setError(cause instanceof Error ? cause.message : "Telegram sign-in failed."));
  }, []);
  if (!error) return null;
  return <div role="alert" style={{ position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 200, padding: 16, background: "#172332", color: "#fff", border: "1px solid #f5c46b" }}>{error}<button type="button" onClick={() => { setError(""); void signInWithTelegram().catch(cause => setError(cause.message)); }} style={{ marginLeft: 12, padding: 10 }}>Retry sign-in</button></div>;
}
