"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu, Maximize, LogOut, HelpCircle, Dices, Undo2 } from "lucide-react";
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
  const [toastText, setToastText] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const { board, turn, selected, dice, remaining } = state;
  const busy = useRef(false);
  const handleDiceBusy = useCallback((value: boolean) => { busy.current = value; setRolling(value); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPhase = useRef(state.phase);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    let pollTimer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const snapshot = await onlineSnapshot(online!, controller.signal);
        if (controller.signal.aborted) return;
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
    <div className={gameLayoutStyles.gameToast} data-visible={toastVisible} role="status" aria-live="polite">{toastText}</div>
    <div className={gameLayoutStyles.playArena} dir="ltr">
      <section className={boardStyles.table} aria-label="تخته نرد ۲۴ خانه">
        <div className={`${boardStyles.board} ${moving ? boardStyles.boardMoving : ""}`} dir="ltr">
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
          {state.phase === "roll" && <div className={boardStyles.rollHologram} aria-hidden="true"><span className={boardStyles.rollHologramHalo}><i className={`${boardStyles.checker} ${turn === "light" ? boardStyles.lightChecker : boardStyles.darkChecker}`}/></span><strong>تاس بریز</strong><span className={boardStyles.rollHologramLine}/></div>}
        </div>
      </section>
      <aside className={gameLayoutStyles.offLane} dir="rtl" aria-label="فضای خروج مهره‌ها">
        {(["dark", "light"] as Side[]).map(side => {
          const options = side === turn ? destinations.filter(option => option.to === "off") : [];
          return <div key={side} className={`${gameLayoutStyles.offPocket} ${options.length ? gameLayoutStyles.offPocketLegal : ""}`} aria-label={`خروج ${names[side]}: ${fa(board.off[side])} از ۱۵ مهره`}>
            <small className={gameLayoutStyles.offPocketTotal}>۱۵</small>
            <i aria-hidden="true" className={`${styles.checker} ${playerRailStyles.railChecker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`}/>
            <strong>{fa(board.off[side])}</strong>
            {options.length > 0 && <div className={gameLayoutStyles.offPocketMoves}>{options.map(option => <button key={option.die} type="button" disabled={locked} aria-label={`خروج مهرهٔ ${names[side]} با تاس ${fa(option.die)}`} onClick={() => move(option)}>تاس {fa(option.die)}</button>)}</div>}
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
          const options=side === turn ? destinations.filter(m=>m.to === "off") : [];
          return <section key={side} className={`${playerRailStyles.playerStats} ${turn === side ? playerRailStyles.activeStats : ""}`} aria-label={`شمارش مهره ${names[side]}`}>
            <div className={playerRailStyles.statsIdentity}><i aria-hidden="true" className={`${styles.checker} ${playerRailStyles.railChecker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`}/><span className={playerRailStyles.statsName}><strong>{names[side]}</strong><small>{playerName(side)}</small></span></div>
            <div className={playerRailStyles.statsDetails}>
              <button data-bar={side} type="button" disabled={locked || state.phase !== "move" || turn !== side || !board.bar[side]} onClick={() => select("bar")} aria-pressed={selected === "bar" && turn === side} aria-label={`مهره‌های زده شده ${names[side]}: ${fa(board.bar[side])}`} className={`${playerRailStyles.barSource} ${selected === "bar" && turn === side ? playerRailStyles.barSelected : ""}`}><span>زده‌شده:</span><span className={playerRailStyles.hitCount}><b>{fa(board.bar[side])}</b></span></button>
              <div className={`${playerRailStyles.offTray} ${options.length ? playerRailStyles.offLegal : ""}`} aria-label={`محل خروج ${names[side]}`}><span><span>خارج‌شده:</span><b>{fa(board.off[side])}</b></span></div>
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
    {state.result && <section className={matchControlsStyles.result} role="status"><h2>{names[state.result.winner]} برنده شد</h2><p>{state.result.dropped ? "برد با رد دوبل" : ["","برد عادی","مارس","بک‌گمون"][state.result.multiplier]} • {fa(state.result.points)} امتیاز{complete ? " • پایان مسابقه" : ""}</p>{state.target && !complete ? <button disabled={locked} onClick={()=>send({type:"nextGame",revision:state.revision})}>دست بعدی مسابقه</button> : <button onClick={onLeave}>بازی جدید</button>}</section>}
    {menuOpen && <BackgammonDrawer onClose={()=>setMenuOpen(false)}>
      <div className={drawerStyles.drawerPlayer}><Dices size={30}/><h2>تخته‌نرد</h2><p>{state.target ? `مسابقه تا ${fa(state.target)} امتیاز` : "بازی ساده • بدون دوبل"}</p><small>درخواست‌دهنده: {names[lobby.colors.requester!]} • حریف: {names[lobby.colors.guest!]}</small></div>
      <button className={drawerStyles.drawerItem} onClick={()=>{onFullscreen();setMenuOpen(false);}}><Maximize size={20}/><span>نمایش تمام‌صفحه<small>تمرکز روی تخته</small></span></button>
      <button className={drawerStyles.drawerItem} aria-label="برگشت حرکت" disabled={locked || !canUndo(state)} onClick={()=>{if(send({type:"undo",revision:state.revision})) setMenuOpen(false);}}><Undo2 size={20}/><span>برگشت حرکت<small>{canUndo(state) ? "برگرداندن آخرین حرکت با همان تاس‌ها" : state.phase === "move" ? "هنوز حرکتی انجام نشده است" : "برگشت پس از پایان نوبت ممکن نیست"}</small></span></button>
      <button className={drawerStyles.drawerItem} aria-expanded={showHelp} onClick={()=>setShowHelp(value=>!value)}><HelpCircle size={20}/><span>راهنمای بازی<small>انتخاب مهره، تاس و برگشت</small></span></button>
      {showHelp && <div className={drawerStyles.drawerHelp}>شماره‌ها از دید بازیکن فعال‌اند؛ از ۲۴ به ۱ برو. هر مقصد فقط یک تاس مصرف می‌کند. مهره‌های زده‌شده و خروج در ستون سمت راست‌اند. باکس تاس را نگه دار؛ پس از رهاکردن، تاس اول در ۵۰۰ میلی‌ثانیه و دومی ۴۰۰ میلی‌ثانیه بعد مشخص می‌شود. برگشت فقط تا پایان نوبت مجاز است.</div>}
      <button className={drawerStyles.drawerItem} onClick={onLeave}><LogOut size={20}/><span>بازی جدید و تنظیمات<small>بازی فعلی پایان می‌یابد؛ بازگشت به انتخاب رنگ</small></span></button>
      <Link className={drawerStyles.drawerItem} href="/games"><LogOut size={20}/><span>خروج به بازی‌ها</span></Link>
      <p className={styles.localNotice}>بازی دونفره روی همین دستگاه</p>
    </BackgammonDrawer>}
  </main>;
}
