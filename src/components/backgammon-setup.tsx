"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Check, ChevronDown, ChevronLeft, Crown, Dices, Share2, Copy } from "lucide-react";
import { canStart, lobbyReducer, newLobby, otherSeat, type LobbyAction, type LobbyState, type Seat } from "@/modules/games/domain/backgammon-lobby";
import styles from "./backgammon-game.module.css";

const colors = { light: "سفید", dark: "سیاه" };
export default function BackgammonSetup({ onStart }: { onStart: (lobby: LobbyState, target: number | null) => void }) {
  const [lobby, setLobby] = useState(newLobby);
  const latest = useRef(lobby);
  const [mode, setMode] = useState("simple");
  const [incomingInvite, setIncomingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
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
    if (started.started) onStart(started, mode === "simple" ? null : Number(mode));
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("invite")) return;
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
  async function shareInvite() {
    if (!lobby.colors.requester) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("invite", crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    url.searchParams.set("color", lobby.colors.requester);
    url.searchParams.set("ready", lobby.ready.requester ? "1" : "0");
    url.searchParams.set("mode", mode);
    const link = url.toString();
    setInviteUrl(link);
    setInviteMessage("");
    if (navigator.share) {
      try { await navigator.share({ title: "دعوت به بازی تخته‌نرد", text: "برای انتخاب رنگ و پیوستن به بازی وارد شو.", url: link }); setInviteMessage("درخواست اشتراک‌گذاری باز شد."); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(link); setInviteMessage("لینک دعوت کپی شد."); }
    catch { setInviteMessage("لینک آماده است؛ آن را کپی و ارسال کن."); }
  }
  async function copyInvite() {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); setInviteMessage("لینک دعوت کپی شد."); }
    catch { setInviteMessage("لینک را از کادر انتخاب و کپی کن."); }
  }
  return <main className={`${styles.page} ${styles.setupPage}`} lang="fa" dir="rtl">
    <header className={styles.setupHeader}><Link href="/games"><ArrowLeft size={18}/> بازی‌ها</Link><span dir="ltr">GMO ARENA / BACKGAMMON</span></header>
    <section className={styles.setupCard} aria-label="آماده‌سازی بازی">
      <span className={styles.setupEyebrow}><Dices size={18}/> پیش از اولین تاس</span>
      <h1>{incomingInvite ? "دعوت به بازی تخته‌نرد" : "رنگ تو، بازی تو."}</h1><p className={styles.setupIntro}>{incomingInvite ? "دعوت باز شد؛ رنگ انتخاب‌شدهٔ درخواست‌دهنده را ببین و رنگ باقی‌مانده را تأیید کن." : "انتخاب و تأیید رنگ‌ها در همین صفحه انجام می‌شود؛ بعد از تأیید هر دو، ورود به بازی را بزنید."}</p>
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
            return <button key={color} type="button" className={selected ? styles.colorChoiceSelected : undefined} onClick={() => selectColor(color)} disabled={!!lobby.swapRequestedBy} aria-pressed={selected} aria-label={selected ? `لغو تأیید مهرهٔ ${colors[color]}` : `انتخاب ${colors[color]}`}>
              <span className={styles.colorChoiceTick} aria-hidden="true">{selected && <Check size={16}/>}</span>
              <i className={`${styles.checker} ${color === "light" ? styles.lightChecker : styles.darkChecker}`}/>
              <span>{selected ? actor === "requester" ? `انتخاب شما: ${colors[color]}` : `${colors[color]} تأیید شد` : actor ? `تأیید ${colors[color]}` : `انتخاب ${colors[color]}`}</span>
            </button>;
          })}</div>
          <button type="button" className={styles.swapButton} disabled={!lobby.colors.requester || !!lobby.swapRequestedBy} onClick={() => send({ type: "requestSwap", actor: incomingInvite ? "guest" : "requester", revision: latest.current.revision })}><ArrowRightLeft size={18}/>درخواست جابه‌جایی مهره‌ها</button>
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
      <button className={styles.shareInvite} disabled={!lobby.colors.requester} onClick={shareInvite}><Share2 size={18}/>{lobby.colors.requester ? "اشتراک‌گذاری لینک درخواست" : "برای ساخت دعوت، اول رنگت را انتخاب کن"}</button>
      {inviteUrl && <div className={styles.inviteLink}><input aria-label="لینک دعوت" readOnly value={inviteUrl} dir="ltr"/><button type="button" onClick={copyInvite} aria-label="کپی لینک دعوت"><Copy size={17}/></button></div>}
      {inviteMessage && <p className={styles.inviteMessage} role="status">{inviteMessage}</p>}
      <button className={styles.startButton} type="button" disabled={!canStart(lobby)} onClick={enterGame}>{canStart(lobby) ? "ورود به بازی" : "پس از تأیید هر دو، ورود به بازی"}<ChevronLeft size={20}/></button>
      <p className={styles.localNotice}>با تأیید هر دو بازیکن، بازی همین‌جا شروع می‌شود. دعوت، مخاطب را به همین صفحهٔ انتخاب رنگ می‌آورد؛ بازی فعلی بین دستگاه‌ها همگام نمی‌شود.</p>
    </section>
  </main>;
}
