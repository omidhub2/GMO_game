"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import LobbyWalletPanel, { type LobbyWalletData } from "./lobby-wallet-panel";
import styles from "./game-menu.module.css";

const emptyWallet: LobbyWalletData = { balances: { BALANCE: "0", REWARDS: "0", PRIZE: "0" }, availableBalance: "0", demo: true };

export default function WalletScreen({ initialTab = "overview" }: { initialTab?: "overview" | "history" }) {
  const [data, setData] = useState(emptyWallet);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/wallet", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Open the app from Telegram to sign in." : "Wallet is unavailable. Please retry.");
      setData(await response.json());
      setNotice("");
    } catch (cause) { setData(emptyWallet); setNotice(cause instanceof Error ? cause.message : "Wallet is unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("gmo:session-changed", refresh);
    return () => window.removeEventListener("gmo:session-changed", refresh);
  }, [refresh]);
  return <main className={styles.scene} style={{ paddingTop: 24, paddingBottom: 24 }}><Link href="/" style={{ color: "#ffd198", marginBottom: 20 }}>← Back to Arena</Link><section className={styles.modal} style={{ margin: "0 auto", width: "100%", maxHeight: "none" }}><LobbyWalletPanel data={data} loading={loading} notice={notice} refresh={() => void refresh()} initialTab={initialTab} /></section></main>;
}
