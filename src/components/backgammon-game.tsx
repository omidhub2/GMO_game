"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Maximize, LogOut, HelpCircle, Dices, Undo2, MessageCircle, Clock3, Send, X, Settings2, Trophy, Crown, Sparkles } from "lucide-react";
import { canDouble, canUndo, gameReducer, legalMoves, newGame, opponent, pointNumber, type GameAction, type Move, type Side, type Source } from "@/modules/games/domain/backgammon";
import type { GameSession, OnlineSnapshot } from "@/modules/games/domain/backgammon-session";
import { computerMove } from "@/modules/games/domain/backgammon-computer";
import { onlineRequest, onlineSnapshot } from "./backgammon-online";
import BackgammonSetup from "./backgammon-setup";
import BackgammonDrawer from "./backgammon-drawer";
import DiceBox from "./backgammon-dice";
import styles from "./backgammon-game.module.css";
import gameLayoutStyles from "./backgammon/styles/game-layout.module.css";
import matchControlsStyles from "./backgammon/styles/match-controls.module.css";
import boardStyles from "./backgammon/styles/board.module.css";
import playerRailStyles from "./backgammon/styles/player-rail.module.css";
import diceStageStyles from "./backgammon/styles/dice-stage.module.css";
import drawerStyles from "./backgammon/styles/drawer.module.css";

const fa = (n: number) => n.toLocaleString("fa-IR");
const names: Record<Side, string> = { light: "سفید", dark: "سیاه" };
/** Rejection sampling avoids modulo bias; results commit before animation. */
function randomDie(): number {
  const buffer = new Uint8Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= 252);
  return buffer[0] % 6 + 1;
}

export default function BackgammonGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  function fullscreen() { const result=shell.current?.requestFullscreen?.(); result?.catch(() => {}); }
  function leave() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const url = new URL(window.location.href);
    url.searchParams.delete("room"); url.searchParams.delete("invite");
    window.history.replaceState(null, "", url);
    setSession(null);
  }
  return <div ref={shell} className={gameLayoutStyles.gameShell}>{session ? <BackgammonTable session={session} onLeave={leave} onFullscreen={fullscreen}/> : <BackgammonSetup onStart={setSession}/>}</div>;
}

function BackgammonTable({ session, onLeave, onFullscreen }: { session: GameSession; onLeave: () => void; onFullscreen: () => void }) {
  const { lobby, target, playMode, online } = session;
  const [state, setState] = useState(() => session.snapshot?.game ?? newGame(target, playMode === "local" ? lobby.colors.guest : null));
  const [networkError, setNetworkError] = useState("");
  const [pending, setPending] = useState(false);
  const [turnSeconds, setTurnSeconds] = useState(30);
  const timeoutSent = useRef(false);
  const requestPending = useRef(false);
  const mounted = useRef(true);
  const humanSide = lobby.colors[session.snapshot?.seat ?? "requester"]!;
  const canAct = playMode === "local" || (state.phase === "opening" || state.phase === "finished"
    ? playMode === "computer" || session.snapshot?.seat === "requester"
    : state.phase === "double" ? state.turn !== humanSide : state.turn === humanSide);
  const current = useRef(state);
  const [rolling, setRolling] = useState(false);
  const [computerRollSignal, setComputerRollSignal] = useState(0);
  const [moving, setMoving] = useState(false);
  const [movingTo, setMovingTo] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messagePulse, setMessagePulse] = useState(false);
  const messagePulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{id:string;seat?:string;text:string;createdAt:number}>>(session.snapshot?.messages ?? []);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [quickMessages, setQuickMessages] = useState<string[]>(["سلام","دمت","موفق","صبر","بازی"]);
  const [quickDrafts, setQuickDrafts] = useState<string[]>(["سلام","آفرین","موفق","صبر","بازی"]);
  const [editingQuick, setEditingQuick] = useState(false);
  const [toastText, setToastText] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const { board, turn, selected, dice, remaining } = state;
  const busy = useRef(false);
  const handleDiceBusy = useCallback((value: boolean) => { busy.current = value; setRolling(value); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenChatIds = useRef(new Set<string>((session.snapshot?.messages ?? []).map(message => message.id)));
  const previousPhase = useRef(state.phase);
  const vibratedTurn = useRef("");
  useEffect(() => {
    if (state.phase !== "roll" || !canAct) { vibratedTurn.current = ""; return; }
    const key = `${state.turn}:${state.turnNumber}`;
    if (vibratedTurn.current === key) return;
    vibratedTurn.current = key;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(120); } catch { /* vibration is optional on unsupported devices */ }
    }
  }, [state.phase, state.turn, state.turnNumber, canAct]);
  // Always reveal the newest chat entry after opening the panel or receiving history/messages.
  // The message list remains mounted in state while the panel is closed.
  useEffect(() => {
    if (!chatOpen) return;
    const frame = requestAnimationFrame(() => {
      const list = chatMessagesRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [chatOpen, chatMessages]);
  useEffect(() => { try { const saved=localStorage.getItem("gmo-backgammon-quick-messages"); if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))setQuickMessages(Array.from({length:5},(_,i)=>String(parsed[i]??"").trim().split(/\\s+/).slice(0,4).join(" ")));} } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("gmo-backgammon-quick-messages",JSON.stringify(quickMessages)); } catch {} }, [quickMessages]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if(messagePulseTimer.current) clearTimeout(messagePulseTimer.current); if(toastTimer.current) clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => {
    if (state.phase !== "move") {
      setTurnSeconds(30);
      timeoutSent.current = false;
      return;
    }
    // The clock starts only after the roll has produced a playable turn.
    setTurnSeconds(30);
    timeoutSent.current = false;
    const interval = setInterval(() => {
      setTurnSeconds(seconds => {
        if (seconds <= 1) {
          if (!timeoutSent.current) {
            timeoutSent.current = true;
            const revision = current.current.revision;
            if (online) {
              void onlineRequest({ operation: "action", action: { type: "timeout", revision } }, online)
                .then(result => {
                  const snapshot = result as OnlineSnapshot;
                  if (mounted.current && snapshot.game && snapshot.game.revision >= current.current.revision) {
                    current.current = snapshot.game; setState(snapshot.game);
                  }
                })
                .catch(error => { timeoutSent.current = false; if (mounted.current) setNetworkError(error instanceof Error ? error.message : "انتقال نوبت انجام نشد."); });
            } else {
              const next = gameReducer(current.current, { type: "timeout", revision });
              if (next !== current.current) { current.current = next; setState(next); }
            }
          }
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, state.turn, state.turnNumber, online]);
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    let pollTimer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const snapshot = await onlineSnapshot(online!, controller.signal);
        if (controller.signal.aborted) return;
        if (snapshot.messages) {
          setChatMessages(snapshot.messages);
          for (const message of snapshot.messages) {
            if (!seenChatIds.current.has(message.id)) {
              seenChatIds.current.add(message.id);
              showChatToast(message.text);
            }
          }
        }
        if (snapshot.game && snapshot.game.revision > current.current.revision && !requestPending.current) {
          current.current = snapshot.game; setState(snapshot.game);
        }
        setNetworkError("");
      } catch (error) { if (!controller.signal.aborted) setNetworkError(error instanceof Error ? error.message : "ارتباط قطع شد؛ در حال تلاش دوباره…"); }
      if (!controller.signal.aborted) pollTimer = setTimeout(poll, 800);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(pollTimer); };
  }, [online]);
  useEffect(() => {
    if (playMode !== "computer" || canAct || rolling || moving) return;
    const aiTimer = setTimeout(() => {
      let next = current.current;
      if (next.phase === "double") next = gameReducer(next, { type: "acceptDouble", revision: next.revision });
      else if (next.phase === "roll") {
        next = gameReducer(next, { type: "roll", dice: [randomDie(), randomDie()], revision: next.revision });
        if (next !== current.current) { setRolling(true); setComputerRollSignal(signal => signal + 1); }
      }
      else if (next.phase === "move") {
        const choice = computerMove(next);
        if (choice) {
          next = gameReducer(next, { type: "select", from: choice.from, revision: next.revision });
          next = gameReducer(next, { type: "move", move: choice, revision: next.revision });
        }
      }
      current.current = next; setState(next);
    }, 700);
    return () => clearTimeout(aiTimer);
  }, [playMode, canAct, state.revision, rolling, moving]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const previous = previousPhase.current;
    const phaseChanged = previous !== state.phase;
    previousPhase.current = state.phase;
    let message = "";
    let duration = 0;
    if (state.phase === "opening") {
      if (state.message.includes("برابر شد")) {
        message = state.message;
        duration = 2400;
      }
    } else if (state.phase === "move" && phaseChanged && previous === "opening") {
      message = names[turn] + " بازی را شروع می‌کند";
      duration = 3200;
    } else if (state.phase === "roll" && state.message.includes("نوبت منتقل شد")) {
      message = state.message;
      duration = 2800;
    } else if (state.phase === "double") {
      message = state.message;
      duration = 3000;
    }
    setToastText(message);
    setToastVisible(!!message);
    if (duration) toastTimer.current = setTimeout(() => setToastVisible(false), duration);
  }, [state.phase, state.message, turn]);
  useEffect(() => {
    function clearSelection(event: MouseEvent | KeyboardEvent) {
      if (busy.current || requestPending.current || playMode === "online" || (playMode === "computer" && current.current.turn !== humanSide) || current.current.selected === null) return;
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : event.target instanceof Element && !!event.target.closest("button,a,select,input,label")) return;
      const next = gameReducer(current.current, { type: "select", from: null, revision: current.current.revision });
      current.current = next; setState(next);
    }
    document.addEventListener("click", clearSelection);
    document.addEventListener("keydown", clearSelection);
    return () => { document.removeEventListener("click", clearSelection); document.removeEventListener("keydown", clearSelection); };
  }, [playMode, humanSide]);
  const moves = useMemo(() => state.phase === "move" ? legalMoves(board, turn, remaining) : [], [board, turn, remaining, state.phase]);
  const destinations = selected === null ? [] : moves.filter(m => m.from === selected);
  const locked = rolling || moving || pending || !canAct;
  const complete = !!state.target && Math.max(state.scores.light, state.scores.dark) >= state.target;
  const [previewResult, setPreviewResult] = useState(false);
  const prePreviewState = useRef<typeof state | null>(null);
  function closeResultPreview() {
    if (!previewResult || !prePreviewState.current) return;
    const restored = prePreviewState.current;
    prePreviewState.current = null;
    setPreviewResult(false);
    current.current = restored; setState(restored);
  }
  function openWhiteWinnerPreview() {
    if (process.env.NODE_ENV === "production" || online || playMode === "online" || state.result) return false;
    if (!prePreviewState.current) prePreviewState.current = current.current;
    const preview = { ...current.current, phase: "finished" as const, result: { winner: "light" as Side, multiplier: 1, points: 3, dropped: false }, message: "پیش‌نمایش آزمایشی پایان بازی؛ امتیاز واقعی ثبت نشده است" };
    current.current = preview; setState(preview); setPreviewResult(true); setResultView("winner");
    setChatText(""); setChatOpen(false);
    return true;
  }
  const [resultView, setResultView] = useState<"winner" | "colors">("winner");
  const [rematchColor, setRematchColor] = useState<Side>(lobby.colors.requester ?? "light");
  const rematchAllowed = playMode !== "online";
  function startRematch() {
    if (!rematchAllowed) return;
    const nextLobby = { ...lobby, colors: { requester: rematchColor, guest: opponent(rematchColor) }, ready: { requester: true, guest: true }, started: true, revision: lobby.revision + 1 };
    const nextGame = { ...newGame(state.target, state.result?.winner ?? null), scores: { ...state.scores }, crawfordUsed: state.crawfordUsed, crawford: !state.crawfordUsed && !!state.target && Math.max(state.scores.light, state.scores.dark) === state.target - 1 };
    current.current = nextGame; setState(nextGame);
    setTurnSeconds(30); setChatOpen(false); setMenuOpen(false); setToastText(""); setToastVisible(false);
    session.lobby = nextLobby;
    setResultView("winner");
  }

  function send(action: GameAction): boolean {
    if ((busy.current && action.type !== "roll") || requestPending.current || !canAct) return false;
    if (online) {
      requestPending.current = true; setPending(true);
      void onlineRequest({ operation: "action", action }, online).then(result => {
        const snapshot = result as OnlineSnapshot;
        if (mounted.current && snapshot.game && snapshot.game.revision >= current.current.revision) {
          current.current = snapshot.game; setState(snapshot.game); setNetworkError("");
        }
      }).catch(error => { if (mounted.current) setNetworkError(error instanceof Error ? error.message : "ارتباط برقرار نشد."); })
        .finally(() => { requestPending.current = false; if (mounted.current) setPending(false); });
      return true;
    }
    const next = gameReducer(current.current, action);
    if (next === current.current) return false;
    current.current = next; setState(next); return true;
  }
  function pulseMessageIcon() {
    setMessagePulse(true);
    if (messagePulseTimer.current) clearTimeout(messagePulseTimer.current);
    messagePulseTimer.current = setTimeout(() => setMessagePulse(false), 10000);
  }
  function showChatToast(text: string) {
    pulseMessageIcon();
    setToastText(text); setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }
  async function postChat(text: string) {
    const clean=text.trim().slice(0,120); if(!clean) return;
    if (clean.replace(/[\u200c\s]+/g, " ").trim() === "پایان بازی سفید برنده" && openWhiteWinnerPreview()) return;
    if(online){
      try {
        const result=await onlineRequest({operation:"message",text:clean},online) as OnlineSnapshot;
        if(result.messages){
          setChatMessages(result.messages);
          const sent=result.messages[result.messages.length-1];
          if(sent){seenChatIds.current.add(sent.id);showChatToast(sent.text);}
        }
      } catch(error){setNetworkError(error instanceof Error?error.message:"ارسال پیام انجام نشد.");return;}
    } else {
      const localMessage={id:`local-${Date.now()}-${Math.random().toString(36).slice(2)}`,text:clean,createdAt:Date.now()};
      seenChatIds.current.add(localMessage.id);
      setChatMessages(items=>[...items,localMessage].slice(-40));
      showChatToast(clean);
    }
    setChatText("");
    setChatOpen(false);
  }
  function animateMove(destination: Move["to"]) {
    busy.current = true; setMoving(true); setMovingTo(typeof destination === "number" ? destination : null);
    timer.current = setTimeout(() => { busy.current = false; setMoving(false); setMovingTo(null); }, 240);
  }
  function roll() {
    if (!canAct || requestPending.current || !["opening", "roll"].includes(current.current.phase) || state.revision !== current.current.revision) return false;
    if (online) return send({ type: "roll", dice: [1, 1], revision: current.current.revision });
    const next=gameReducer(current.current,{ type:"roll", dice:[randomDie(),randomDie()], revision:state.revision });
    if (next === current.current) return false;
    current.current=next; setState(next); return true;
  }
  function move(move: Move) {
    if (send({ type: "move", move, revision: state.revision })) animateMove(move.to);
  }
  function select(from: Source | null) { send({ type: "select", from, revision: state.revision }); }
  function clickPoint(index: number) {
    if (locked || busy.current) return;
    if (selected === index) { select(null); return; }
    const choices = destinations.filter(m => m.to === index);
    if (choices.length === 1) { move(choices[0]); return; }
    if (board.points[index]?.side === turn) select(index);
    else select(null);
  }
  function renderPoint(index: number, upper: boolean) {
    const point = board.points[index]; const options = destinations.filter(m => m.to === index);
    const number = pointNumber(index, turn);
    return <button key={index} type="button" data-point={index} disabled={locked || state.phase !== "move"}
      aria-label={`خانه ${fa(number)}${point ? `، ${fa(point.count)} مهره ${names[point.side]}` : "، خالی"}${options.length ? `؛ مقصد مجاز با تاس ${options.map(m => fa(m.die)).join(" یا ")}${options[0].hit ? "، زدن" : ""}` : ""}`}
      aria-pressed={selected === index} onClick={() => clickPoint(index)}
      className={`${boardStyles.point} ${upper ? boardStyles.upperPoint : boardStyles.lowerPoint} ${index % 2 ? boardStyles.goldPoint : ""} ${selected === index ? boardStyles.selectedPoint : ""} ${options.length ? boardStyles.legalPoint : ""}`}>
      <span className={boardStyles.checkerStack}>{point && Array.from({ length: Math.min(point.count, 5) }, (_, i) => <i key={i} aria-hidden="true" className={`${boardStyles.checker} ${point.side === "light" ? boardStyles.lightChecker : boardStyles.darkChecker} ${upper ? boardStyles.stackTop : boardStyles.stackBottom} ${i === Math.min(point.count, 5) - 1 && selected === index ? boardStyles.selectedChecker : ""} ${i === Math.min(point.count, 5) - 1 && movingTo === index ? boardStyles.movedChecker : ""}`} style={{ "--stack": `${i}` } as React.CSSProperties}>{point.count > 5 && i === 4 ? <b>{fa(point.count)}</b> : null}</i>)}</span>
      {options.length > 0 && <span className={boardStyles.moveBadge}>{options.map(m => fa(m.die)).join(" / ")}{options[0].hit ? " × زدن" : ""}</span>}
    </button>;
  }

  const playerName = (side: Side) => playMode === "computer" ? side === humanSide ? "شما" : "کامپیوتر" : playMode === "online" ? side === humanSide ? "شما" : "حریف آنلاین" : lobby.colors.requester === side ? "بازیکن اول" : "بازیکن دوم";
  return <main lang="fa" dir="rtl" data-play-mode={playMode} data-board-theme="simple" className={`${styles.page} ${boardStyles.playPage}`}>
    <div className={gameLayoutStyles.playArena} dir="ltr">
      <section className={boardStyles.table} aria-label="تخته نرد ۲۴ خانه">
        <div className={`${boardStyles.board} ${moving ? boardStyles.boardMoving : ""}`} dir="ltr">
          {state.phase === "roll" && <div className={boardStyles.rollHologram} role="status" aria-live="polite"><span className={boardStyles.rollHologramHalo}><span className={`${boardStyles.checker} ${turn === "light" ? boardStyles.lightChecker : boardStyles.darkChecker} ${boardStyles.hologramChecker}`} aria-label={turn === "light" ? "مهره سفید" : "مهره سیاه"}/></span><strong>{canAct ? "نوبت شماست؛ تاس بریزید" : playMode === "computer" ? "نوبت کامپیوتر؛ در حال تاس‌ریختن" : "نوبت حریف؛ منتظر تاس"}</strong><span className={boardStyles.rollHologramLine}/></div>}
          <div className={boardStyles.chatToast} data-chat-toast data-visible={toastVisible} role="status" aria-live="polite">{toastText}</div>
          {chatOpen && <button type="button" className={boardStyles.chatBackdrop} aria-label="بستن گفتگوی بازی" onClick={()=>setChatOpen(false)}/>}
          {chatOpen && <section className={boardStyles.chatPanel} data-chat-panel dir="rtl" aria-label="گفتگوی بازی"><header><span>گفتگوی بازی <small>GMO ARENA</small></span><button type="button" aria-label="بستن چت" onClick={()=>setChatOpen(false)}><X size={18}/></button></header><div ref={chatMessagesRef} className={boardStyles.chatMessages} aria-live="polite">{chatMessages.map(message=><p key={message.id}><span>{message.seat==="requester"?"بازیکن اول":message.seat==="guest"?"بازیکن دوم":"شما"}</span>{message.text}</p>)}</div><form className={boardStyles.chatComposer} onSubmit={event=>{event.preventDefault();void postChat(chatText);}}><input value={chatText} maxLength={120} onChange={event=>setChatText(event.target.value)} placeholder="پیام خود را بنویسید…" aria-label="متن پیام"/><button type="submit" disabled={!chatText.trim()} aria-label="ارسال پیام"><Send size={17}/></button></form></section>}{chatOpen && <div className={boardStyles.quickMessages} role="group" aria-label="پیام‌های سریع">{quickMessages.map((message,i)=>message&&<button key={i} type="button" onClick={()=>void postChat(message)}>{message}</button>)}</div>}

          <div className={`${boardStyles.half} ${boardStyles.topLeft}`}>{Array.from({length:6},(_,i)=>renderPoint(12+i,true))}</div>
          <div className={`${boardStyles.half} ${boardStyles.topRight}`}>{Array.from({length:6},(_,i)=>renderPoint(18+i,true))}</div>
          <div className={boardStyles.bar} aria-label="مهره‌های زده‌شده در وسط تخته">
            <span className={boardStyles.barBrand} aria-hidden="true">GMO</span>
            <button type="button" data-undo-bar aria-label="برگشت آخرین حرکت" title="برگشت آخرین حرکت" className={boardStyles.barUndo} disabled={locked || !canUndo(state)} onClick={() => send({ type: "undo", revision: state.revision })}><Undo2 size={16} strokeWidth={2.5}/></button>
            {(["dark", "light"] as Side[]).map(side => board.bar[side] > 0 && <button key={side} type="button" className={`${boardStyles.barHit} ${side === "dark" ? boardStyles.barHitTop : boardStyles.barHitBottom} ${selected === "bar" && turn === side ? boardStyles.barHitSelected : ""} ${state.phase === "move" && turn === side ? boardStyles.barEntryCue : ""}`} disabled={locked || state.phase !== "move" || turn !== side} aria-label={`${fa(board.bar[side])} مهرهٔ زده‌شدهٔ ${names[side]}؛ اول این مهره را برای ورود انتخاب کن`} aria-pressed={selected === "bar" && turn === side} onClick={() => select(selected === "bar" ? null : "bar")}><b>{fa(board.bar[side])}</b><i aria-hidden="true" className={`${boardStyles.checker} ${side === "light" ? boardStyles.lightChecker : boardStyles.darkChecker}`}/></button>)}
            <span className={boardStyles.barBrand} aria-hidden="true">ARENA</span>
          </div>
          <div className={`${boardStyles.half} ${boardStyles.bottomLeft}`}>{Array.from({length:6},(_,i)=>renderPoint(11-i,false))}</div>
          <div className={`${boardStyles.half} ${boardStyles.bottomRight}`}>{Array.from({length:6},(_,i)=>renderPoint(5-i,false))}</div>
        </div>
      </section>
      <aside className={gameLayoutStyles.offLane} dir="rtl" aria-label="فضای خروج مهره‌ها">
        {(["dark", "light"] as Side[]).map(side => {
          const options = side === turn ? destinations.filter(option => option.to === "off") : [];
          const canBearOff = options.length > 0 && !locked;
          return <div
            key={side}
            className={`${gameLayoutStyles.offPocket} ${canBearOff ? gameLayoutStyles.offPocketLegal : ""}`}
            data-off-tray={side}
            role="button"
            tabIndex={canBearOff ? 0 : -1}
            aria-label={`خروج مهره‌های ${names[side]}؛ ${board.off[side]} مهره خارج‌شده`}
            aria-disabled={!canBearOff}
            onClick={() => { if (canBearOff) move(options[0]); }}
            onKeyDown={event => {
              if ((event.key === "Enter" || event.key === " ") && canBearOff) {
                event.preventDefault();
                move(options[0]);
              }
            }}
          >
            <strong className={gameLayoutStyles.offPocketCount} aria-live="polite">{String(board.off[side])}</strong>
            <div className={gameLayoutStyles.offPocketStack} data-off-stack aria-hidden="true">
              {Array.from({length: board.off[side]}, (_, index) => <i key={index} className={`${styles.checker} ${gameLayoutStyles.offPocketChecker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`} style={{ bottom: `calc(${index} * var(--off-stack-step))` }}/>) }
            </div>
          </div>;
        })}
      </aside>
      <aside className={`${playerRailStyles.rightRail} ${diceStageStyles.diceStageRail}`} dir="rtl" aria-label="شمارش مهره‌ها در سمت راست">
        <div className={playerRailStyles.railControls} dir="ltr">
          <span className={playerRailStyles.playBrand} dir="ltr">GMO<span>ARENA</span></span>
          <button className={playerRailStyles.menuToggle} dir="rtl" disabled={rolling || moving} aria-label="باز کردن منوی بازی" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20}/><span>منو</span></button>
        </div>
        <div className={diceStageStyles.diceStage} dir="ltr">
          <DiceBox dice={dice} usedDice={state.phase === "move" ? state.usedDice : []} canRoll={canAct && !pending && !moving && ["opening","roll"].includes(state.phase)} opening={state.phase === "opening"} computerRollSignal={computerRollSignal} onRoll={roll} onBusy={handleDiceBusy}/>
          <div className={`${diceStageStyles.turnPrompt} ${state.phase === "roll" ? diceStageStyles.turnPromptRolling : ""}`} data-visible={state.phase !== "opening"} role="status" aria-live="polite" dir="rtl">
            {state.phase !== "opening" && <i aria-hidden="true" className={styles.checker + " " + diceStageStyles.railChecker + " " + (turn === "light" ? styles.lightChecker : styles.darkChecker)}/>}
            <span>{!canAct ? playMode === "computer" ? "نوبت کامپیوتر" : "منتظر حریف" : state.phase === "move" ? "بازی کن" : "تاس بریز"}</span>
          </div>
        </div>
        <p className={playerRailStyles.sessionStatus} role="status">{playMode === "computer" ? "تک‌نفره • آفلاین" : playMode === "online" ? "دونفره • آنلاین" : "دونفره • آفلاین"}{networkError && <span role="alert">{networkError}</span>}</p>
        <div className={playerRailStyles.statsPair}>
        {(["dark","light"] as Side[]).map(side => {
          return <section key={side} dir="ltr" className={`${playerRailStyles.playerStats} ${turn === side ? playerRailStyles.activeStats : ""}`} aria-label={`پروفایل بازیکن ${names[side]}`}>
            <div className={playerRailStyles.avatarWrap}>
              <div className={playerRailStyles.profileAvatar} data-player-avatar aria-label={`آواتار ${playerName(side)}`}>
                <span aria-hidden="true">{playerName(side).slice(0, 1)}</span>
              </div>
            </div>
            <div className={playerRailStyles.profileInfo} dir="rtl">
              <div className={playerRailStyles.profileHeading}>
                <div className={playerRailStyles.profileName}>
                  <strong>{playerName(side)}</strong>
                </div>
              </div>
              <div className={playerRailStyles.profileScore} data-player-score>
                <button type="button" data-player-message className={playerRailStyles.messageButton} aria-label={`پیام به ${playerName(side)}`} onClick={()=>setChatOpen(true)} title="ارسال پیام">
                  <MessageCircle className={messagePulse ? playerRailStyles.messagePulse : ""} size={19} strokeWidth={1.9}/>
                </button>
                <span className={`${styles.checker} ${playerRailStyles.profileChecker} ${side === "light" ? styles.lightChecker : styles.darkChecker} ${side === "dark" ? playerRailStyles.darkPlayerChecker : ""}`} data-player-checker aria-label={`مهره ${names[side]}`} role="img"/>
              </div>
            </div>
            <div className={playerRailStyles.profileMeta} dir="ltr">
              <span className={playerRailStyles.profileMetaItem} data-player-match-score aria-label={`امتیاز مسابقه ${state.scores[side]}`}>
                <Trophy size={13}/>
                <small>{String(state.scores[side])}</small>
              </span>
              <span className={playerRailStyles.profileMetaItem} data-player-timer aria-label={`زمان باقی‌مانده ${turn === side ? turnSeconds : 30} ثانیه`}>
                <Clock3 size={13}/>
                <small>{`00:${String(turn === side ? turnSeconds : 30).padStart(2,"0")}`}</small>
              </span>
            </div>
          </section>;
        })}
        {state.target && <div className={playerRailStyles.cubeSummary}>مکعب ×{fa(state.cube)}<small>{state.cubeOwner ? `مالک: ${names[state.cubeOwner]}` : "بدون مالک"}{state.crawford ? " • Crawford" : ""}</small></div>}
      </div>
      </aside>
    </div>
    {state.target && <footer className={matchControlsStyles.playFooter}>
      <div className={matchControlsStyles.actions}><button disabled={locked || !canDouble(state)} onClick={()=>send({type:"offerDouble",revision:state.revision})}>پیشنهاد دوبل ×{fa(state.cube * 2)}</button></div>
    </footer>}
    {state.phase === "double" && <section className={matchControlsStyles.result} aria-label="پاسخ دوبل"><h2>{names[opponent(turn)]}؛ پیشنهاد دوبل ×{fa(state.cube * 2)}</h2><p>با رد، {fa(state.cube)} امتیاز به {names[turn]} می‌رسد.</p><button disabled={locked} onClick={()=>send({type:"acceptDouble",revision:state.revision})}>پذیرش دوبل</button><button disabled={locked} onClick={()=>send({type:"rejectDouble",revision:state.revision})}>رد دوبل</button></section>}
    {state.result && <div className={matchControlsStyles.resultOverlay}>
      <section className={matchControlsStyles.resultModal} role="dialog" aria-modal="true" aria-labelledby="backgammon-result-title" aria-describedby="backgammon-result-description" dir="rtl">
        {previewResult && <div role="status" className={matchControlsStyles.resultOnlineNote}>پیش‌نمایش آزمایشی — هیچ امتیاز واقعی ثبت نشده است <button type="button" onClick={closeResultPreview}>بستن پیش‌نمایش و بازگشت به بازی</button></div>}
        {resultView === "winner" ? <>
        <div className={matchControlsStyles.resultOrnament} aria-hidden="true"><Sparkles/><span/><Sparkles/></div>
        <div className={matchControlsStyles.resultBadge}><Crown size={16}/> {complete ? "قهرمان مسابقه" : "پایان دست"}</div>
        <div className={matchControlsStyles.resultWinner}>
          <div className={matchControlsStyles.resultAvatar} aria-label={`آواتار ${playerName(state.result.winner)}`}>
            <span>{playerName(state.result.winner).slice(0,1)}</span>
            <i className={`${boardStyles.checker} ${state.result.winner === "light" ? boardStyles.lightChecker : boardStyles.darkChecker}`} aria-label={`مهره ${names[state.result.winner]}`}/>
          </div>
          <div className={matchControlsStyles.resultWinnerText}>
            <span>آفرین!</span>
            <h2 id="backgammon-result-title">{playerName(state.result.winner)} برنده شد</h2>
            <p id="backgammon-result-description">مهره {names[state.result.winner]} این دست را برد.</p>
          </div>
        </div>
        <div className={matchControlsStyles.resultScoreGrid}>
          <div className={matchControlsStyles.resultScoreCard}>
            <span>امتیاز این دست</span>
            <strong>+{fa(state.result.points)}</strong>
            <small>{state.result.dropped ? "برد با رد دوبل" : ["","برد عادی","مارس","بک‌گمون"][state.result.multiplier]}</small>
          </div>
          <div className={matchControlsStyles.resultScoreCard}>
            <span>امتیاز مسابقه</span>
            <strong>{fa(state.scores[state.result.winner])}<small>{state.target ? ` / ${fa(state.target)}` : ""}</small></strong>
            <small>{complete ? "هدف مسابقه تکمیل شد" : "امتیاز ثبت‌شده"}</small>
          </div>
        </div>
        <div className={matchControlsStyles.resultStandings} aria-label="امتیاز هر دو بازیکن">
          <span>سفید <b>{fa(state.scores.light)}</b></span>
          <span>سیاه <b>{fa(state.scores.dark)}</b></span>
        </div>
        <div className={matchControlsStyles.resultActions}>
          <button type="button" className={matchControlsStyles.resultPrimary} disabled={!rematchAllowed || previewResult} onClick={startRematch}>شروع مجدد</button>
          <button type="button" className={matchControlsStyles.resultSecondary} disabled={!rematchAllowed || previewResult} onClick={()=>{setRematchColor(lobby.colors.requester ?? "light");setResultView("colors");}}>انتخاب دوباره مهره‌ها</button>
          <button type="button" className={matchControlsStyles.resultExit} onClick={()=>{window.location.assign("/games");}}>پایان بازی</button>
        </div>
        {playMode === "online" && <p className={matchControlsStyles.resultOnlineNote}>برای شروع مجدد بازی آنلاین، هماهنگی و تأیید هر دو بازیکن لازم است.</p>}
        {state.target && !complete && <button type="button" className={matchControlsStyles.resultContinue} disabled={locked} onClick={()=>send({type:"nextGame",revision:state.revision})}>دست بعدی مسابقه بدون تغییر مهره‌ها</button>}
        </> : <>
          <div className={matchControlsStyles.resultOrnament} aria-hidden="true"><Sparkles/><span/><Sparkles/></div>
          <div className={matchControlsStyles.resultBadge}><Crown size={16}/> انتخاب رنگ مهره‌ها</div>
          <h2 className={matchControlsStyles.rematchTitle}>بازیکنان رنگ مهره‌ها را انتخاب کنند</h2>
          <p id="backgammon-result-description" className={matchControlsStyles.rematchDescription}>بازیکن اول رنگ خود را انتخاب می‌کند؛ رنگ بازیکن دوم به‌صورت خودکار مخالف خواهد بود. امتیازهای مسابقه حفظ می‌شوند.</p>
          <div className={matchControlsStyles.rematchChoices} role="group" aria-label="انتخاب رنگ بازیکن اول">
            <button type="button" aria-pressed={rematchColor === "light"} className={rematchColor === "light" ? matchControlsStyles.rematchChoiceSelected : ""} onClick={()=>setRematchColor("light")}><i className={`${boardStyles.checker} ${boardStyles.lightChecker}`}/> سفید</button>
            <button type="button" aria-pressed={rematchColor === "dark"} className={rematchColor === "dark" ? matchControlsStyles.rematchChoiceSelected : ""} onClick={()=>setRematchColor("dark")}><i className={`${boardStyles.checker} ${boardStyles.darkChecker}`}/> سیاه</button>
          </div>
          <div className={matchControlsStyles.rematchActions}>
            <button type="button" className={matchControlsStyles.resultPrimary} onClick={startRematch}>شروع مجدد</button>
            <button type="button" className={matchControlsStyles.resultSecondary} onClick={()=>setResultView("winner")}>بازگشت</button>
          </div>
          {playMode === "online" && <p className={matchControlsStyles.resultOnlineNote}>تغییر رنگ در بازی آنلاین نیازمند تأیید هر دو بازیکن است.</p>}
        </> }
      </section>
    </div>}
    {menuOpen && <BackgammonDrawer onClose={()=>setMenuOpen(false)}>
      <div className={drawerStyles.drawerPlayer}><Dices size={30}/><h2>تخته‌نرد</h2><p>{state.target ? `مسابقه تا ${fa(state.target)} امتیاز` : "بازی ساده • بدون دوبل"}</p><small>درخواست‌دهنده: {names[lobby.colors.requester!]} • حریف: {names[lobby.colors.guest!]}</small></div>
      <button className={drawerStyles.drawerItem} onClick={()=>{onFullscreen();setMenuOpen(false);}}><Maximize size={20}/><span>نمایش تمام‌صفحه<small>تمرکز روی تخته</small></span></button>
      <button className={drawerStyles.drawerItem} aria-label="برگشت حرکت" disabled={locked || !canUndo(state)} onClick={()=>{if(send({type:"undo",revision:state.revision})) setMenuOpen(false);}}><Undo2 size={20}/><span>برگشت حرکت<small>{canUndo(state) ? "برگرداندن آخرین حرکت با همان تاس‌ها" : state.phase === "move" ? "هنوز حرکتی انجام نشده است" : "برگشت پس از پایان نوبت ممکن نیست"}</small></span></button>
      <button className={drawerStyles.drawerItem} onClick={()=>setEditingQuick(value=>!value)} aria-expanded={editingQuick}><Settings2 size={20}/><span>تنظیم پیام‌های سریع<small>حداکثر ۵ پیام سریع؛ هر پیام تا ۴ کلمه</small></span></button>
      {editingQuick && <div className={drawerStyles.quickSettings}><p>برای هر پیام سریع می‌توانید تا ۴ کلمه بنویسید. پنج پیام را می‌توانید جداگانه تنظیم کنید.</p>{quickDrafts.map((value,index)=><label key={index}>پیام {index+1}<input value={value} maxLength={72} placeholder="مثلاً: حرکت خوبی بود" onChange={event=>setQuickDrafts(items=>items.map((item,i)=>{if(i!==index)return item;const words=event.target.value.trimStart().split(/\\s+/);return words.length>4?words.slice(0,4).join(" "):event.target.value;}))}/></label>)}<button type="button" onClick={()=>{setQuickMessages(quickDrafts.map(value=>value.trim().split(/\\s+/).slice(0,4).join(" ")));setEditingQuick(false);}}>ذخیره پیام‌ها</button></div>}
      <button className={drawerStyles.drawerItem} aria-expanded={showHelp} onClick={()=>setShowHelp(value=>!value)}><HelpCircle size={20}/><span>راهنمای بازی<small>انتخاب مهره، تاس و برگشت</small></span></button>
      {showHelp && <div className={drawerStyles.drawerHelp}>شماره‌ها از دید بازیکن فعال‌اند؛ از ۲۴ به ۱ برو. هر مقصد فقط یک تاس مصرف می‌کند. مهره‌های زده‌شده و خروج در ستون سمت راست‌اند. باکس تاس را نگه دار؛ پس از رهاکردن، تاس اول در ۵۰۰ میلی‌ثانیه و دومی ۴۰۰ میلی‌ثانیه بعد مشخص می‌شود. برگشت فقط تا پایان نوبت مجاز است.</div>}
      <button className={drawerStyles.drawerItem} onClick={onLeave}><LogOut size={20}/><span>بازی جدید و تنظیمات<small>بازی فعلی پایان می‌یابد؛ بازگشت به انتخاب رنگ</small></span></button>
      <Link className={drawerStyles.drawerItem} href="/games"><LogOut size={20}/><span>خروج به بازی‌ها</span></Link>
      <p className={styles.localNotice}>{playMode==="online"?"چت آنلاین اتاق بازی":"پیام‌های محلی بازی"}</p>
    </BackgammonDrawer>}
  </main>;
}
