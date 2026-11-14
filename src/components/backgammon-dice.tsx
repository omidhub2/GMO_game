"use client";
import React, { useEffect, useRef, useState } from "react";
import styles from "./backgammon-game.module.css";

const pips = { 1:["50% 50%"], 2:["26% 26%","74% 74%"], 3:["26% 26%","50% 50%","74% 74%"], 4:["26% 26%","74% 26%","26% 74%","74% 74%"], 5:["26% 26%","74% 26%","50% 50%","26% 74%","74% 74%"], 6:["26% 22%","74% 22%","26% 50%","74% 50%","26% 78%","74% 78%"] } as const;
export function Die({ value, spinning, hidden, second, preview = false }: { value: number; spinning: boolean; hidden: boolean; second: boolean; preview?: boolean }) {
  const [rx, ry] = [[0,0],[0,-90],[0,180],[0,90],[-90,0],[90,0]][value - 1];
  return <span role="img" aria-label={preview ? "نمای تاس پیش از شروع" : hidden ? "تاس در حال چرخش" : `تاس ${value.toLocaleString("fa-IR")}`} data-preview={preview} data-revealed={!hidden} className={`${styles.dieScene} ${spinning ? styles.spinning : styles.revealed} ${second ? styles.secondDie : ""}`}>
    <span aria-hidden="true" className={styles.dieCube} style={{ "--rx": `${rx}deg`, "--ry": `${ry}deg` } as React.CSSProperties}>
      {[1,2,3,4,5,6].map(face => <span key={face} className={`${styles.dieFace} ${styles[`face${face}`]}`}>{pips[face as keyof typeof pips].map((position, i) => <i key={i} style={{ left: position.split(" ")[0], top: position.split(" ")[1] }} />)}</span>)}
    </span>
  </span>;
}

type Visual = "idle" | "holding" | "settling" | "first";
export default function DiceBox({ dice, canRoll, opening, prompt, onRoll, onBusy }: {
  dice: [number, number] | null; canRoll: boolean; opening: boolean; prompt?: React.ReactNode;
  onRoll: () => boolean; onBusy: (busy: boolean) => void;
}) {
  const [visual, setVisual] = useState<Visual>("idle");
  const [pattern, setPattern] = useState(0);
  const stage = useRef<Visual>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pointer = useRef<number | null>(null);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  function begin() {
    if (!canRoll || stage.current !== "idle") return;
    stage.current = "holding"; setVisual("holding"); setPattern(p => (p + 1) % 3); onBusy(true);
  }
  function cancel() {
    if (stage.current !== "holding") return;
    stage.current = "idle"; setVisual("idle"); pointer.current = null; onBusy(false);
  }
  function release() {
    if (stage.current !== "holding") return;
    pointer.current = null;
    if (!onRoll()) { cancel(); return; }
    stage.current = "settling"; setVisual("settling");
    // Neither timeout changes dice or game state. They only reveal committed results.
    timers.current = [setTimeout(() => { stage.current = "first"; setVisual("first"); }, 500),
      setTimeout(() => { stage.current = "idle"; setVisual("idle"); onBusy(false); }, 900)];
  }
  const spinning = visual !== "idle";
  return <button type="button" data-dice-box data-dice-hit-area="full-stage" data-pattern={pattern} data-stage={visual}
    className={`${styles.diceBox} ${spinning ? styles.diceBoxActive : ""}`}
    aria-label={opening ? "تاس شروع" : "تاس بریز"}
    disabled={!canRoll && !spinning}
    onPointerDown={event => {
      if (event.button !== 0 || pointer.current !== null || stage.current !== "idle" || !canRoll) return;
      pointer.current = event.pointerId; begin();
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic events and old WebViews may lack capture. */ }
    }}
    onPointerUp={event => { if (pointer.current === event.pointerId) release(); }}
    onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) begin(); } }}
    onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); release(); } }}
    onClick={() => { if (stage.current === "idle" && canRoll) { begin(); release(); } }}>
    <span className={styles.diceContent} dir="ltr">
      <span className={styles.centerDice}>
        {dice || spinning ? <><Die value={visual === "holding" || visual === "settling" ? 1 : dice?.[0] ?? 1} spinning={visual === "holding" || visual === "settling"} hidden={visual === "holding" || visual === "settling"} second={false}/><Die value={spinning ? 1 : dice?.[1] ?? 1} spinning={spinning} hidden={spinning} second/></> : <><Die value={2} spinning={false} hidden={false} second={false} preview/><Die value={5} spinning={false} hidden={false} second preview/></>}
      </span>
    </span>
    <span className={styles.turnPrompt} data-turn-prompt data-visible={opening ? "false" : "true"} role="status" aria-live="polite" dir="rtl">{prompt}</span>
  </button>;
}
