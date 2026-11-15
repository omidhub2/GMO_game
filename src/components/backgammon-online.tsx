"use client";
import React, { useEffect, useRef, useState } from "react";
import type { GameSession, OnlineCredentials, OnlineSnapshot } from "@/modules/games/domain/backgammon-session";
import setupStyles from "./backgammon-setup.module.css";
import onlineStyles from "./backgammon/styles/online.module.css";
import setupStyles from "./backgammon-setup.module.css";

export async function onlineRequest(body: Record<string, unknown>, credentials?: OnlineCredentials): Promise<unknown> {
  const response = await fetch("/api/games/backgammon", {
    method: "POST", headers: { "Content-Type": "application/json", ...(credentials ? { Authorization: `Bearer ${credentials.token}` } : {}) },
    body: JSON.stringify({ ...body, ...(credentials ? { room: credentials.room } : {}) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "ارتباط برقرار نشد.");
  return result;
}
export async function onlineSnapshot(credentials: OnlineCredentials, signal?: AbortSignal): Promise<OnlineSnapshot> {
  const response = await fetch(`/api/games/backgammon?room=${encodeURIComponent(credentials.room)}`, { cache: "no-store", headers: { Authorization: `Bearer ${credentials.token}` }, signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "ارتباط برقرار نشد.");
  return result;
}

export default function BackgammonOnline({ onStart }: { onStart: (session: GameSession) => void }) {
  const [invite] = useState(() => new URLSearchParams(window.location.search).get("room"));
  const [credentials, setCredentials] = useState<OnlineCredentials | null>(null);
  const [snapshot, setSnapshot] = useState<OnlineSnapshot | null>(null);
  const [color, setColor] = useState<"light" | "dark">("light");
  const [target, setTarget] = useState("simple");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const startRef = useRef(onStart); startRef.current = onStart;
  useEffect(() => {
    if (!invite) return;
    try {
      const token = sessionStorage.getItem(`backgammon-room-${invite}`);
      if (token) setCredentials({ room: invite, token });
    } catch { /* A session can still be played without browser storage. */ }
  }, [invite]);
  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await onlineSnapshot(credentials!, controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot(next); setError("");
        if (next.game && !started.current) {
          started.current = true;
          startRef.current({ playMode: "online", lobby: next.lobby, target: next.target, online: credentials!, snapshot: next });
          return;
        }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "ارتباط قطع شد؛ در حال تلاش دوباره…"); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [credentials]);
  async function connect() {
    setBusy(true); setError("");
    try {
      const result = await onlineRequest(invite ? { operation: "join", room: invite } : { operation: "create", color, target: target === "simple" ? null : Number(target) }) as OnlineCredentials;
      if (!mounted.current) return;
      try { sessionStorage.setItem(`backgammon-room-${result.room}`, result.token); } catch { /* Storage is optional. */ }
      const currentUrl = new URL(window.location.href);
      currentUrl.search = ""; currentUrl.searchParams.set("room", result.room);
      window.history.replaceState(null, "", currentUrl);
      setCredentials(result);
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "ارتباط برقرار نشد."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function ready() {
    if (!credentials) return;
    setBusy(true); setError("");
    try { const next = await onlineRequest({ operation: "ready" }, credentials) as OnlineSnapshot; if (mounted.current) setSnapshot(next); }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "ارتباط برقرار نشد."); }
    finally { if (mounted.current) setBusy(false); }
  }
  const url = credentials ? new URL(`/games/backgammon?room=${credentials.room}`, window.location.origin).toString() : "";
  return <section className={onlineStyles.onlineLobby} aria-label="اتاق آنلاین" aria-busy={busy}>
    <h2>دونفرهٔ آنلاین</h2>
    <p>هر بازیکن با دستگاه خودش بازی می‌کند. اتصال هر دو نفر به همین سرور لازم است.</p>
    {!credentials ? <>
      {invite ? <p>به بازی دعوت شده‌ای؛ برای دریافت جایگاه نفر دوم وارد اتاق شو.</p> : <>
        <fieldset className={setupStyles.playModeField}><legend>رنگ شما</legend><div className={setupStyles.playModeChoices}>
          {(["light", "dark"] as const).map(side => <label key={side}><input type="radio" name="online-color" value={side} checked={color === side} onChange={() => setColor(side)}/><span>{side === "light" ? "سفید" : "سیاه"}</span></label>)}
        </div></fieldset>
        <label className={onlineStyles.onlineTarget}>حالت مسابقه<select value={target} onChange={event => setTarget(event.target.value)}><option value="simple">ساده؛ بدون دوبل</option>{[1,3,5,7,9,11].map(n => <option key={n} value={n}>مسابقه تا {n.toLocaleString("fa-IR")} امتیاز</option>)}</select></label>
      </>}
      <button className={setupStyles.startButton} disabled={busy} onClick={connect}>{busy ? "در حال اتصال…" : invite ? "پیوستن به اتاق" : "ساخت اتاق آنلاین"}</button>
    </> : <>
      <p role="status">{snapshot?.joined ? "هر دو بازیکن وارد اتاق شده‌اند." : "منتظر ورود نفر دوم از لینک دعوت…"}</p>
      {snapshot && <p>رنگ شما: {snapshot.lobby.colors[snapshot.seat] === "light" ? "سفید" : "سیاه"}</p>}
      {snapshot?.seat === "requester" && <div className={onlineStyles.inviteLink}><input aria-label="لینک دعوت آنلاین" readOnly value={url} dir="ltr"/><button aria-label="کپی لینک دعوت" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopyMessage("لینک دعوت کپی شد."); } catch { setCopyMessage("لینک را از کادر انتخاب و کپی کن."); } }}>کپی</button></div>}
      {copyMessage && <p role="status">{copyMessage}</p>}
      {snapshot?.seat === "guest" && <button className={setupStyles.startButton} disabled={busy || snapshot.lobby.started} onClick={ready}>تأیید رنگ و شروع بازی</button>}
    </>}
    {error && <p role="alert" className={onlineStyles.onlineError}>{error}</p>}
    <p className={setupStyles.localNotice}>اتاق آزمایشی تا ۶ ساعت روی همین سرور نگه‌داری می‌شود و با راه‌اندازی دوبارهٔ سرور پاک می‌شود.</p>
  </section>;
}
