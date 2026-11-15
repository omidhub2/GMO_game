"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Check, ChevronDown, ChevronLeft, Crown, Dices } from "lucide-react";
import { canStart, lobbyReducer, newLobby, otherSeat, type LobbyAction, type Seat } from "@/modules/games/domain/backgammon-lobby";
import type { GameSession } from "@/modules/games/domain/backgammon-session";
import BackgammonOnline from "./backgammon-online";
import styles from "./backgammon-setup.module.css";

const colors = { light: "سفید", dark: "سیاه" };
export default function BackgammonSetup({ onStart }: { onStart: (session: GameSession) => void }) {
  const [connection, setConnection] = useState<"offline" | "online" | null>(null);
  const [players, setPlayers] = useState<"local" | "computer" | null>(null);
  const [lobby, setLobby] = useState(newLobby);
  const latest = useRef(lobby);
  const [mode, setMode] = useState("simple");
  const [incomingInvite, setIncomingInvite] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const modeField = useRef<HTMLDivElement>(null);
  function send(action: LobbyAction) {
    const next = lobbyReducer(latest.current, action);
    latest.current = next; setLobby(next); return next;
  }
  function selectColor(color: "light" | "dark") {
    if (latest.current.swapRequestedBy) return;
    if (!latest.current.colors.requester) {
      send({ type: "choose", color, actor: "requester", revision: latest.current.revision });
      send({ type: "ready", actor: "requester", revision: latest.current.revision });
      if (players === "computer") send({ type: "ready", actor: "guest", revision: latest.current.revision });
      return;
    }
    if (players === "computer") {
      const next = newLobby(); latest.current = next; setLobby(next);
      send({ type: "choose", color, actor: "requester", revision: latest.current.revision });
      send({ type: "ready", actor: "requester", revision: latest.current.revision });
      send({ type: "ready", actor: "guest", revision: latest.current.revision });
      return;
    }
    const actor: Seat = latest.current.colors.requester === color ? "requester" : "guest";
    send({ type: "ready", actor, revision: latest.current.revision });
  }
  function enterGame() {
    if (!canStart(latest.current)) return;
    const started = lobbyReducer(latest.current, { type: "start", actor: "requester", revision: latest.current.revision });
    latest.current = started;
    setLobby(started);
    if (started.started && players) onStart({ lobby: started, target: mode === "simple" ? null : Number(mode), playMode: players });
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("room")) { setConnection("online"); return; }
    if (!params.has("invite")) return;
    setConnection("offline"); setPlayers("local");
    setIncomingInvite(true);
    const color = params.get("color");
    if (color === "light" || color === "dark") {
      let next = lobbyReducer(latest.current, { type: "choose", color, actor: "requester", revision: latest.current.revision });
      if (params.get("ready") === "1") next = lobbyReducer(next, { type: "ready", actor: "requester", revision: next.revision });
      latest.current = next; setLobby(next);
    }
    const matchMode = params.get("mode");
    if (matchMode && ["simple","1","3","5","7","9","11"].includes(matchMode)) setMode(matchMode);
  }, []);
  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!modeField.current?.contains(event.target as Node)) setModeOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModeOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  function resetChoices(nextConnection: "offline" | "online", nextPlayers: "local" | "computer" | null = null) {
    setConnection(nextConnection); setPlayers(nextPlayers);
    const next = newLobby(); latest.current = next; setLobby(next);
    setModeOpen(false);
  }
  return <main className={`${styles.page} ${styles.setupPage}`} lang="fa" dir="rtl">
    <header className={styles.setupHeader}><Link href="/games"><ArrowLeft size={18}/> بازی‌ها</Link><span dir="ltr">GMO ARENA / BACKGAMMON</span></header>
    <section className={styles.setupCard} aria-label="آماده‌سازی بازی">
      <span className={styles.setupEyebrow}><Dices size={18}/> پیش از اولین تاس</span>
      <h1>تخته‌نرد؛ چطور بازی می‌کنی؟</h1>
      <p className={styles.setupIntro}>ابتدا آفلاین یا آنلاین را انتخاب کن، سپس بازیکن‌ها و تنظیمات بازی را مشخص کن.</p>
      <fieldset className={styles.playModeField}><legend>نوع اتصال</legend><div className={styles.playModeChoices}>
        <label><input type="radio" name="connection" aria-label="آفلاین" checked={connection === "offline"} onChange={() => resetChoices("offline")}/><span>آفلاین<small>بازی روی همین دستگاه</small></span></label>
        <label><input type="radio" name="connection" aria-label="آنلاین" checked={connection === "online"} onChange={() => resetChoices("online")}/><span>آنلاین<small>دونفره روی دو دستگاه</small></span></label>
      </div></fieldset>
      {connection === "offline" && <fieldset className={styles.playModeField}><legend>تعداد بازیکن‌ها</legend><div className={styles.playModeChoices}>
        <label><input type="radio" name="players" aria-label="تک‌نفره با کامپیوتر" checked={players === "computer"} onChange={() => resetChoices("offline", "computer")}/><span>تک‌نفره با کامپیوتر<small>نفر دوم، کامپیوتر است</small></span></label>
        <label><input type="radio" name="players" aria-label="دونفره روی یک دستگاه" checked={players === "local"} onChange={() => resetChoices("offline", "local")}/><span>دونفره روی یک دستگاه<small>هر دو بازیکن کنار هم</small></span></label>
      </div></fieldset>}
      {connection === "online" && <BackgammonOnline onStart={onStart}/>}
      {connection === "offline" && players && <>
      <p className={styles.setupIntro}>{players === "computer" ? "رنگ خودت را انتخاب کن؛ رنگ مقابل برای کامپیوتر است." : "هر بازیکن رنگ خود را تأیید کند؛ سپس وارد بازی شوید."}</p>
      <div className={styles.seatGrid}>
        <article className={styles.seatCard} aria-label="انتخاب رنگ مهره‌ها">
          <div className={styles.seatHeading}><span><Crown size={18}/> درخواست‌دهنده</span><small>اولویت انتخاب</small></div>
          <div className={styles.colorSelectionStatus} role="status" aria-live="polite">
            <span className={styles.emptyChecker}>{canStart(lobby) ? <Check size={22}/> : "؟"}</span>
            <span>{!lobby.colors.requester ? "منتظر انتخاب اول" : lobby.swapRequestedBy ? "در انتظار پاسخ نفر دوم به درخواست جابه‌جایی" : canStart(lobby) ? "هر دو مهره تأیید شدند" : !lobby.ready.requester && !lobby.ready.guest ? "مهره‌ها مشخص‌اند؛ منتظر انتخاب و تأیید دوبارهٔ هر دو بازیکن" : `منتظر تأیید مهرهٔ ${colors[lobby.ready.requester ? lobby.colors.guest! : lobby.colors.requester]} هستیم`}</span>
          </div>
          <div className={styles.colorChoices}>{(["light", "dark"] as const).map(color => {
            const actor: Seat | null = !lobby.colors.requester ? null : lobby.colors.requester === color ? "requester" : "guest";
            const selected = actor !== null && lobby.ready[actor];
            return <button key={color} type="button" className={selected ? styles.colorChoiceSelected : undefined} onClick={() => selectColor(color)} disabled={!!lobby.swapRequestedBy} aria-pressed={players === "computer" ? actor === "requester" : selected} aria-label={selected && players === "local" ? `لغو تأیید مهرهٔ ${colors[color]}` : `انتخاب ${colors[color]}`}>
              <span className={styles.colorChoiceTick} aria-hidden="true">{selected && <Check size={16}/>}</span>
              <i className={`${styles.checker} ${color === "light" ? styles.lightChecker : styles.darkChecker}`}/>
              <span>{players === "computer" && selected ? actor === "requester" ? `انتخاب شما: ${colors[color]}` : `کامپیوتر: ${colors[color]}` : selected ? actor === "requester" ? `انتخاب شما: ${colors[color]}` : `${colors[color]} تأیید شد` : actor ? `تأیید ${colors[color]}` : `انتخاب ${colors[color]}`}</span>
            </button>;
          })}</div>
          {players === "local" && <button type="button" className={styles.swapButton} disabled={!lobby.colors.requester || !!lobby.swapRequestedBy} onClick={() => send({ type: "requestSwap", actor: incomingInvite ? "guest" : "requester", revision: latest.current.revision })}><ArrowRightLeft size={18}/>درخواست جابه‌جایی مهره‌ها</button>}
          {lobby.swapRequestedBy && <section className={styles.swapRequest} aria-label="درخواست جابه‌جایی مهره‌ها">
            <div><strong>جابه‌جایی فقط با تأیید نفر دوم</strong><p>با پذیرش درخواست، رنگ‌ها عوض می‌شوند و هر دو بازیکن باید دوباره مهرهٔ خود را تأیید کنند.</p></div>
            <div className={styles.swapActions}>
              <button type="button" onClick={() => send({ type: "acceptSwap", actor: otherSeat(lobby.swapRequestedBy!), revision: latest.current.revision })}>پذیرش توسط نفر دوم</button>
              <button type="button" onClick={() => send({ type: "rejectSwap", actor: otherSeat(lobby.swapRequestedBy!), revision: latest.current.revision })}>رد توسط نفر دوم</button>
              <button type="button" onClick={() => send({ type: "cancelSwap", actor: lobby.swapRequestedBy!, revision: latest.current.revision })}>لغو درخواست</button>
            </div>
          </section>}
        </article>
      </div>
      <div className={styles.pregameSettings}><span>حالت بازی</span><div className={styles.modeField} ref={modeField}>
        <button id="match-mode" type="button" className={styles.modeTrigger} aria-haspopup="listbox" aria-expanded={modeOpen} aria-controls="match-mode-options" onClick={() => setModeOpen(open => !open)}><span>{mode === "simple" ? "ساده؛ بدون دوبل" : `مسابقه تا ${Number(mode).toLocaleString("fa-IR")} امتیاز`}</span><ChevronDown size={19} className={modeOpen ? styles.modeChevronOpen : ""}/></button>
        {modeOpen && <div id="match-mode-options" className={styles.modeOptions} role="listbox" aria-label="انتخاب حالت بازی">
          {[["simple","ساده؛ بدون دوبل"], ...[1,3,5,7,9,11].map(n => [String(n),`مسابقه تا ${n.toLocaleString("fa-IR")} امتیاز`])].map(([value,label]) => <button key={value} type="button" role="option" aria-selected={mode === value} className={mode === value ? styles.modeOptionSelected : ""} onClick={() => { setMode(value); setModeOpen(false); }}><span>{label}</span>{mode === value && <Check size={17}/>}</button>)}
        </div>}
      </div><p>تنظیمات پیش از شروع اعمال می‌شوند. رنگ مهره، شروع‌کننده را تعیین نمی‌کند؛ تاس شروع تصمیم می‌گیرد.</p></div>
      <button className={styles.startButton} type="button" disabled={!canStart(lobby)} onClick={enterGame}>{canStart(lobby) ? "ورود به بازی" : "پس از تأیید هر دو، ورود به بازی"}<ChevronLeft size={20}/></button>
      <p className={styles.localNotice}>{players === "computer" ? "شما و کامپیوتر به نوبت بازی می‌کنید. تاس شروع، نفر اول را تعیین می‌کند." : "بازی دونفرهٔ آفلاین است؛ هر دو نفر از همین دستگاه استفاده می‌کنند."}</p>
      </>}
    </section>
  </main>;
}
