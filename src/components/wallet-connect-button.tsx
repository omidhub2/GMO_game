"use client";

import { useState } from "react";
import { useWalletSession } from "./wallet-session";
import { signInWithTelegram } from "./telegram-session";

export function WalletConnectButton() {
  const session = useWalletSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    setError("");
    try { await signInWithTelegram(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Telegram sign-in failed."); }
    finally { setBusy(false); }
  }
  return <div className="wallet-connect-wrap">
    {session ? <span className="wallet-connect-button connected">Signed in with Telegram</span> : <button className="wallet-connect-button" type="button" onClick={signIn} disabled={busy}>{busy ? "Signing in…" : "Sign in with Telegram"}</button>}
    {error && <span className="wallet-connect-error" role="alert">{error}</span>}
  </div>;
}
