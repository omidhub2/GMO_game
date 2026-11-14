"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Maximize, LogOut, HelpCircle, Dices, Undo2 } from "lucide-react";
import { canDouble, canUndo, gameReducer, legalMoves, newGame, opponent, pointNumber, type GameAction, type Move, type Side, type Source } from "@/modules/games/domain/backgammon";
import type { LobbyState } from "@/modules/games/domain/backgammon-lobby";
import BackgammonSetup from "./backgammon-setup";
import BackgammonDrawer from "./backgammon-drawer";
import DiceBox from "./backgammon-dice";
import styles from "./backgammon-game.module.css";

const fa = (n: number) => n.toLocaleString("fa-IR");
const names: Record<Side, string> = { light: "سفید", dark: "سیاه" };

/** Rejection sampling avoids modulo bias; results commit before animation. */
function randomDie(): number {
  const buffer = new Uint8Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= 252);
  return buffer[0] % 6 + 1;
}

export default function BackgammonGame() {
  const [session, setSession] = useState<{ lobby: LobbyState; target: number | null } | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  function fullscreen() { const result=shell.current?.requestFullscreen?.(); result?.catch(() => {}); }
  function leave() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setSession(null);
  }
  return <div ref={shell} className={styles.gameShell}>{session ? <BackgammonTable lobby={session.lobby} target={session.target} onLeave={leave} onFullscreen={fullscreen}/> : <BackgammonSetup onStart={(lobby,target) => setSession({lobby,target})}/>}</div>;
}

function BackgammonTable({ lobby, target, onLeave, onFullscreen }: { lobby: LobbyState; target: number | null; onLeave: () => void; onFullscreen: () => void }) {
  const [state, setState] = useState(() => newGame(target, lobby.colors.guest ?? "dark"));
  const current = useRef(state);
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [movingTo, setMovingTo] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toastText, setToastText] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const { board, turn, selected, dice, remaining } = state;
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPhase = useRef(state.phase);
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
    } else if (state.phase === "move" && phaseChanged) {
      message = previous === "opening" ? names[turn] + " بازی را شروع می‌کند" : "تاس ریخته شد";
      duration = previous === "opening" ? 3200 : 1400;
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
      if (busy.current || current.current.selected === null) return;
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : event.target instanceof Element && !!event.target.closest("button,a,select,input,label")) return;
      const next = gameReducer(current.current, { type: "select", from: null, revision: current.current.revision });
      current.current = next; setState(next);
    }
    document.addEventListener("click", clearSelection);
    document.addEventListener("keydown", clearSelection);
    return () => { document.removeEventListener("click", clearSelection); document.removeEventListener("keydown", clearSelection); };
  }, []);
  const moves = useMemo(() => state.phase === "move" ? legalMoves(board, turn, remaining) : [], [board, turn, remaining, state.phase]);
  const destinations = selected === null ? [] : moves.filter(m => m.from === selected);
  const locked = rolling || moving;
  const complete = !!state.target && Math.max(state.scores.light, state.scores.dark) >= state.target;

  function send(action: GameAction): boolean {
    if (busy.current) return false;
    const next = gameReducer(current.current, action);
    if (next === current.current) return false;
    current.current = next; setState(next); return true;
  }
  function animateMove(destination: Move["to"]) {
    busy.current = true; setMoving(true); setMovingTo(typeof destination === "number" ? destination : null);
    timer.current = setTimeout(() => { busy.current = false; setMoving(false); setMovingTo(null); }, 240);
  }
  function roll() {
    if (!["opening", "roll"].includes(current.current.phase) || state.revision !== current.current.revision) return false;
    const next=gameReducer(current.current,{ type:"roll", dice:[randomDie(),randomDie()], revision:state.revision });
    if (next === current.current) return false;
    current.current=next; setState(next); return true;
  }
  function move(move: Move) {
    if (send({ type: "move", move, revision: state.revision })) animateMove(move.to);
  }
  function select(from: Source | null) { send({ type: "select", from, revision: state.revision }); }
  function clickPoint(index: number) {
    if (busy.current) return;
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
      className={`${styles.point} ${upper ? styles.upperPoint : styles.lowerPoint} ${index % 2 ? styles.goldPoint : ""} ${selected === index ? styles.selectedPoint : ""} ${options.length ? styles.legalPoint : ""}`}>
      <span className={styles.checkerStack}>{point && Array.from({ length: Math.min(point.count, 5) }, (_, i) => <i key={i} aria-hidden="true" className={`${styles.checker} ${point.side === "light" ? styles.lightChecker : styles.darkChecker} ${upper ? styles.stackTop : styles.stackBottom} ${i === Math.min(point.count, 5) - 1 && selected === index ? styles.selectedChecker : ""} ${i === Math.min(point.count, 5) - 1 && movingTo === index ? styles.movedChecker : ""}`} style={{ "--stack": `${i}` } as React.CSSProperties}>{point.count > 5 && i === 4 ? <b>{fa(point.count)}</b> : null}</i>)}</span>
      {options.length > 0 && <span className={styles.moveBadge}>{options.map(m => fa(m.die)).join(" / ")}{options[0].hit ? " × زدن" : ""}</span>}
    </button>;
  }

  const playerName = (side: Side) => lobby.colors.requester === side ? "درخواست‌دهنده" : "حریف";
  return <main lang="fa" dir="rtl" className={`${styles.page} ${styles.playPage}`}>
    <div className={styles.gameToast} data-visible={toastVisible} role="status" aria-live="polite">{toastText}</div>
    <div className={styles.playArena} dir="ltr">
      <section className={styles.table} aria-label="تخته نرد ۲۴ خانه">
        <div className={`${styles.board} ${moving ? styles.boardMoving : ""}`} dir="ltr">
          <div className={`${styles.half} ${styles.topLeft}`}>{Array.from({length:6},(_,i)=>renderPoint(12+i,true))}</div>
          <div className={`${styles.half} ${styles.topRight}`}>{Array.from({length:6},(_,i)=>renderPoint(18+i,true))}</div>
          <div className={styles.bar} aria-label="مهره‌های زده‌شده در وسط تخته">
            <span className={styles.barBrand} aria-hidden="true">GMO</span>
            {(["dark", "light"] as Side[]).map(side => board.bar[side] > 0 && <button key={side} type="button" className={`${styles.barHit} ${side === "dark" ? styles.barHitTop : styles.barHitBottom} ${selected === "bar" && turn === side ? styles.barHitSelected : ""} ${state.phase === "move" && turn === side ? styles.barEntryCue : ""}`} disabled={locked || state.phase !== "move" || turn !== side} aria-label={`${fa(board.bar[side])} مهرهٔ زده‌شدهٔ ${names[side]}؛ اول این مهره را برای ورود انتخاب کن`} aria-pressed={selected === "bar" && turn === side} onClick={() => select(selected === "bar" ? null : "bar")}><b>{fa(board.bar[side])}</b><i aria-hidden="true" className={`${styles.checker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`}/></button>)}
            <span className={styles.barBrand} aria-hidden="true">ARENA</span>
          </div>
          <div className={`${styles.half} ${styles.bottomHalf} ${styles.bottomLeft}`}>{Array.from({length:6},(_,i)=>renderPoint(11-i,false))}</div>
          <div className={`${styles.half} ${styles.bottomHalf} ${styles.bottomRight}`}>{Array.from({length:6},(_,i)=>renderPoint(5-i,false))}</div>
          {state.phase === "roll" && <div className={styles.rollHologram} aria-hidden="true"><span className={styles.rollHologramHalo}><i className={`${styles.checker} ${turn === "light" ? styles.lightChecker : styles.darkChecker}`}/></span><strong>تاس بریز</strong><span className={styles.rollHologramLine}/></div>}
        </div>
      </section>
      <aside className={styles.offLane} dir="rtl" aria-label="فضای خروج مهره‌ها">
        {(["dark", "light"] as Side[]).map(side => {
          const options = side === turn ? destinations.filter(option => option.to === "off") : [];
          return <div key={side} className={`${styles.offPocket} ${options.length ? styles.offPocketLegal : ""}`} aria-label={`خروج ${names[side]}: ${fa(board.off[side])} از ۱۵ مهره`}>
            <i aria-hidden="true" className={`${styles.checker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`}/>
            <strong>{fa(board.off[side])}<small> / ۱۵</small></strong>
            {options.length > 0 && <div className={styles.offPocketMoves}>{options.map(option => <button key={option.die} type="button" disabled={locked} aria-label={`خروج مهرهٔ ${names[side]} با تاس ${fa(option.die)}`} onClick={() => move(option)}>تاس {fa(option.die)}</button>)}</div>}
          </div>;
        })}
      </aside>
      <aside className={styles.rightRail} dir="rtl" aria-label="شمارش مهره‌ها در سمت راست">
        <div className={styles.railControls} dir="ltr">
          <span className={styles.playBrand} dir="ltr">GMO<span>ARENA</span></span>
          <button className={styles.menuToggle} dir="rtl" disabled={locked} aria-label="باز کردن منوی بازی" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20}/><span>منو</span></button>
        </div>
        <div className={styles.diceStage} dir="ltr">
          <DiceBox dice={dice} usedDice={state.phase === "move" ? state.usedDice : []} canRoll={!moving && ["opening","roll"].includes(state.phase)} opening={state.phase === "opening"} onRoll={roll} onBusy={value => { busy.current=value; setRolling(value); }}/>
          <div className={`${styles.turnPrompt} ${state.phase === "roll" ? styles.turnPromptRolling : ""}`} data-visible={state.phase !== "opening"} role="status" aria-live="polite" dir="rtl">
            {state.phase !== "opening" && <i aria-hidden="true" className={styles.checker + " " + (turn === "light" ? styles.lightChecker : styles.darkChecker)}/>}
            <span>{state.phase === "move" ? "بازی کن" : "تاس بریز"}</span>
          </div>
        </div>
        <div className={styles.statsPair}>
        {(["dark","light"] as Side[]).map(side => {
          const options=side === turn ? destinations.filter(m=>m.to === "off") : [];
          return <section key={side} className={`${styles.playerStats} ${turn === side ? styles.activeStats : ""}`} aria-label={`شمارش مهره ${names[side]}`}>
            <div className={styles.statsIdentity}><i aria-hidden="true" className={`${styles.checker} ${side === "light" ? styles.lightChecker : styles.darkChecker}`}/><span className={styles.statsName}><strong>{names[side]}</strong><small>{playerName(side)}</small></span></div>
            <div className={styles.statsDetails}>
              <button data-bar={side} type="button" disabled={locked || state.phase !== "move" || turn !== side || !board.bar[side]} onClick={() => select("bar")} aria-pressed={selected === "bar" && turn === side} aria-label={`مهره‌های زده شده ${names[side]}: ${fa(board.bar[side])}`} className={`${styles.barSource} ${selected === "bar" && turn === side ? styles.barSelected : ""}`}><span>زده‌شده:</span><span className={styles.hitCount}><b>{fa(board.bar[side])}</b></span></button>
              <div className={`${styles.offTray} ${options.length ? styles.offLegal : ""}`} aria-label={`محل خروج ${names[side]}`}><span><span>خارج‌شده:</span><b>{fa(board.off[side])}</b></span></div>
            </div>
          </section>;
        })}
        {state.target && <div className={styles.cubeSummary}>مکعب ×{fa(state.cube)}<small>{state.cubeOwner ? `مالک: ${names[state.cubeOwner]}` : "بدون مالک"}{state.crawford ? " • Crawford" : ""}</small></div>}
      </div>
      </aside>
    </div>
    {state.target && <footer className={styles.playFooter}>
      <div className={styles.actions}><button disabled={locked || !canDouble(state)} onClick={()=>send({type:"offerDouble",revision:state.revision})}>پیشنهاد دوبل ×{fa(state.cube * 2)}</button></div>
    </footer>}
    {state.phase === "double" && <section className={styles.result} aria-label="پاسخ دوبل"><h2>{names[opponent(turn)]}؛ پیشنهاد دوبل ×{fa(state.cube * 2)}</h2><p>با رد، {fa(state.cube)} امتیاز به {names[turn]} می‌رسد.</p><button onClick={()=>send({type:"acceptDouble",revision:state.revision})}>پذیرش دوبل</button><button onClick={()=>send({type:"rejectDouble",revision:state.revision})}>رد دوبل</button></section>}
    {state.result && <section className={styles.result} role="status"><h2>{names[state.result.winner]} برنده شد</h2><p>{state.result.dropped ? "برد با رد دوبل" : ["","برد عادی","مارس","بک‌گمون"][state.result.multiplier]} • {fa(state.result.points)} امتیاز{complete ? " • پایان مسابقه" : ""}</p>{state.target && !complete ? <button onClick={()=>send({type:"nextGame",revision:state.revision})}>دست بعدی مسابقه</button> : <button onClick={onLeave}>بازی جدید</button>}</section>}
    {menuOpen && <BackgammonDrawer onClose={()=>setMenuOpen(false)}>
      <div className={styles.drawerPlayer}><Dices size={30}/><h2>تخته‌نرد</h2><p>{state.target ? `مسابقه تا ${fa(state.target)} امتیاز` : "بازی ساده • بدون دوبل"}</p><small>درخواست‌دهنده: {names[lobby.colors.requester!]} • حریف: {names[lobby.colors.guest!]}</small></div>
      <button className={styles.drawerItem} onClick={()=>{onFullscreen();setMenuOpen(false);}}><Maximize size={20}/><span>نمایش تمام‌صفحه<small>تمرکز روی تخته</small></span></button>
      <button className={styles.drawerItem} aria-label="برگشت حرکت" disabled={locked || !canUndo(state)} onClick={()=>{if(send({type:"undo",revision:state.revision})) setMenuOpen(false);}}><Undo2 size={20}/><span>برگشت حرکت<small>{canUndo(state) ? "برگرداندن آخرین حرکت با همان تاس‌ها" : state.phase === "move" ? "هنوز حرکتی انجام نشده است" : "برگشت پس از پایان نوبت ممکن نیست"}</small></span></button>
      <button className={styles.drawerItem} aria-expanded={showHelp} onClick={()=>setShowHelp(value=>!value)}><HelpCircle size={20}/><span>راهنمای بازی<small>انتخاب مهره، تاس و برگشت</small></span></button>
      {showHelp && <div className={styles.drawerHelp}>شماره‌ها از دید بازیکن فعال‌اند؛ از ۲۴ به ۱ برو. هر مقصد فقط یک تاس مصرف می‌کند. مهره‌های زده‌شده و خروج در ستون سمت راست‌اند. باکس تاس را نگه دار؛ پس از رهاکردن، تاس اول در ۵۰۰ میلی‌ثانیه و دومی ۴۰۰ میلی‌ثانیه بعد مشخص می‌شود. برگشت فقط تا پایان نوبت مجاز است.</div>}
      <button className={styles.drawerItem} onClick={onLeave}><LogOut size={20}/><span>بازی جدید و تنظیمات<small>بازی فعلی پایان می‌یابد؛ بازگشت به انتخاب رنگ</small></span></button>
      <Link className={styles.drawerItem} href="/games"><LogOut size={20}/><span>خروج به بازی‌ها</span></Link>
      <p className={styles.localNotice}>بازی دونفره روی همین دستگاه</p>
    </BackgammonDrawer>}
  </main>;
}
