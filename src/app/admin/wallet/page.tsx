"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/game-menu.module.css";

type Withdrawal = { id: string; amount: string; payoutAmount: string | null; externalReference: string | null; status: string; createdAt: string };
const units = (raw: string) => `${BigInt(raw) / 1_000_000n}.${(BigInt(raw) % 1_000_000n).toString().padStart(6, "0")}`;

export default function WalletAdministration() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/wallet/withdrawals", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load withdrawals.");
      setRows(result.data);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not load withdrawals."); }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("gmo:session-changed", refresh);
    return () => window.removeEventListener("gmo:session-changed", refresh);
  }, [refresh]);
  async function act(id: string, action: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/wallet/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, txHash: hashes[id] || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Update failed.");
      setMessage("Withdrawal updated.");
      await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Update failed."); }
    finally { setBusy(false); }
  }
  return <main className={styles.scene} style={{ padding: 24 }}><Link href="/wallet">← Wallet</Link><h1>Withdrawal review</h1><p>Mark a request as processing, send the displayed USDT payout from the configured treasury wallet, then verify its confirmed transaction ID.</p><button className={styles.deploy} onClick={() => void refresh()} disabled={busy}>Refresh</button>{message && <p role="status">{message}</p>}{rows.map(row => <section key={row.id} style={{ background: "#172332", padding: 20, marginTop: 20, overflowWrap: "anywhere" }}><h2>{units(row.amount)} GMO</h2><p>{row.status} · {new Date(row.createdAt).toLocaleString("en-US")}</p><p>Payout {row.payoutAmount ? `${units(row.payoutAmount)} USDT` : "Calculated when marked processing"}</p><p>Destination {row.externalReference}</p><small>Request {row.id}</small>{row.status === "PENDING" ? <div className={styles.walletActions}><button disabled={busy} onClick={() => void act(row.id, "PROCESS")}>Mark processing</button><button disabled={busy} onClick={() => void act(row.id, "REJECT")}>Reject</button></div> : <form className={styles.vaultForm} onSubmit={event => { event.preventDefault(); void act(row.id, "COMPLETE"); }}><label>Confirmed payout transaction ID<input required pattern="[a-fA-F0-9]{64}" value={hashes[row.id] || ""} onChange={event => setHashes({ ...hashes, [row.id]: event.target.value.trim() })} /></label><button className={styles.deploy} disabled={busy}>Verify payout and complete</button></form>}</section>)}</main>;
}
