/** Physical indices are fixed: light moves 23 -> 0, dark moves 0 -> 23.
 * UI direction and point labels must never change these coordinates. */
export type Side = "light" | "dark";
export type Point = { side: Side; count: number } | null;
export type Source = number | "bar";
export type Destination = number | "off";
export interface Board { points: Point[]; bar: Record<Side, number>; off: Record<Side, number> }
export interface Move { from: Source; to: Destination; die: number; hit: boolean }
export const opponent = (side: Side): Side => side === "light" ? "dark" : "light";
export const pointNumber = (index: number, side: Side) => side === "light" ? index + 1 : 24 - index;
export function initialBoard(): Board {
  const points: Point[] = Array(24).fill(null);
  for (const side of ["light", "dark"] as const) {
    for (const [number, count] of [[24, 2], [13, 5], [8, 3], [6, 5]]) {
      points[side === "light" ? number - 1 : 24 - number] = { side, count };
    }
  }
  return { points, bar: { light: 0, dark: 0 }, off: { light: 0, dark: 0 } };
}
export const expandDice = ([a, b]: readonly number[]) => a === b ? [a, a, a, a] : [a, b];
const withoutDie = (dice: number[], die: number) => { const next = [...dice]; next.splice(next.indexOf(die), 1); return next; };
export function canBearOff(board: Board, side: Side): boolean {
  return !board.bar[side] && board.points.every((p, i) => !p || p.side !== side || pointNumber(i, side) <= 6);
}
/** Geometric single-die moves; callers must use legalMoves for mandatory dice use. */
export function singleDieMoves(board: Board, side: Side, die: number): Move[] {
  if (!Number.isInteger(die) || die < 1 || die > 6 || board.off[side] === 15) return [];
  const sources: Source[] = board.bar[side] ? ["bar"] : board.points.flatMap((p, i) => p?.side === side ? [i] : []);
  const home = canBearOff(board, side);
  const highest = Math.max(0, ...board.points.map((p, i) => p?.side === side ? pointNumber(i, side) : 0));
  return sources.flatMap<Move>(from => {
    const number = from === "bar" ? 25 : pointNumber(from, side);
    if (number - die <= 0) {
      return home && (number === die || number === highest) ? [{ from, to: "off" as const, die, hit: false }] : [];
    }
    const to = side === "light" ? number - die - 1 : 24 - (number - die);
    const target = board.points[to];
    if (target && target.side !== side && target.count >= 2) return [];
    return [{ from, to, die, hit: !!target && target.side !== side }];
  });
}
function applyStep(board: Board, side: Side, move: Move): Board {
  const next: Board = { points: board.points.map(p => p && { ...p }), bar: { ...board.bar }, off: { ...board.off } };
  if (move.from === "bar") next.bar[side]--;
  else { const p = next.points[move.from]!; next.points[move.from] = p.count === 1 ? null : { side, count: p.count - 1 }; }
  if (move.to === "off") next.off[side]++;
  else {
    const target = next.points[move.to];
    if (target && target.side !== side) next.bar[target.side]++;
    next.points[move.to] = { side, count: target?.side === side ? target.count + 1 : 1 };
  }
  return next;
}
/** Dynamic programming explores every dice order and continuation, retaining only
 * first steps of maximal-length plays. Equal doubles are explored just once. */
export function legalMoves(board: Board, side: Side, remaining: number[]): Move[] {
  const memo = new Map<string, number>();
  function maxSteps(position: Board, dice: number[]): number {
    if (!dice.length || position.off[side] === 15) return 0;
    const key = JSON.stringify([position, [...dice].sort()]);
    const cached = memo.get(key); if (cached !== undefined) return cached;
    let best = 0;
    for (const die of new Set(dice)) {
      for (const move of singleDieMoves(position, side, die)) {
        best = Math.max(best, 1 + maxSteps(applyStep(position, side, move), withoutDie(dice, die)));
      }
    }
    memo.set(key, best); return best;
  }
  const maximum = maxSteps(board, remaining);
  if (!maximum) return [];
  let candidates = [...new Set(remaining)].flatMap(die => singleDieMoves(board, side, die))
    .filter(move => 1 + maxSteps(applyStep(board, side, move), withoutDie(remaining, move.die)) === maximum);
  if (maximum === 1 && remaining.length === 2 && remaining[0] !== remaining[1]) {
    const higher = Math.max(...candidates.map(m => m.die));
    candidates = candidates.filter(m => m.die === higher);
  }
  return candidates;
}
export function winMultiplier(board: Board, winner: Side): 1 | 2 | 3 {
  const loser = opponent(winner);
  if (board.off[loser]) return 1;
  return board.bar[loser] || board.points.some((p, i) => p?.side === loser && pointNumber(i, winner) <= 6) ? 3 : 2;
}

interface Snapshot { board: Board; remaining: number[]; usedDice: number[] }
export interface GameState {
  board: Board; turn: Side; phase: "opening" | "roll" | "move" | "double" | "finished";
  dice: [number, number] | null; remaining: number[]; usedDice: number[]; history: Snapshot[];
  selected: Source | null; revision: number; message: string; turnNumber: number;
  target: number | null; scores: Record<Side, number>; cube: number; cubeOwner: Side | null;
  crawford: boolean; crawfordUsed: boolean;
  result: { winner: Side; multiplier: number; points: number; dropped: boolean } | null;
}
export function newGame(target: number | null = null, starter: Side | null = null): GameState {
  return { board: initialBoard(), turn: starter ?? "light", phase: starter ? "roll" : "opening", dice: null, remaining: [], usedDice: [], history: [], selected: null,
    revision: 0, turnNumber: 1, target, scores: { light: 0, dark: 0 }, cube: 1, cubeOwner: null,
    crawford: target === 1, crawfordUsed: target === 1, result: null, message: starter ? "نوبت آغازگر؛ تاس بریز" : "تاس شروع: برای هر بازیکن یک تاس بریز" };
}
export function canDouble(state: GameState): boolean {
  return state.target !== null && !state.crawford && state.phase === "roll" && (state.cubeOwner === null || state.cubeOwner === state.turn);
}
export const canUndo = (state: GameState) => state.phase === "move" && state.history.length > 0;
function finish(state: GameState, winner: Side, dropped = false): GameState {
  const multiplier = dropped ? 1 : winMultiplier(state.board, winner);
  const points = multiplier * state.cube;
  return { ...state, phase: "finished", selected: null, history: [], remaining: [],
    scores: { ...state.scores, [winner]: state.scores[winner] + points },
    result: { winner, multiplier, points, dropped }, message: dropped ? "دوبل رد شد؛ بازی پایان یافت" : "پانزدهمین مهره خارج شد؛ بازی پایان یافت" };
}
function continueOrPass(state: GameState): GameState {
  if (state.board.off[state.turn] === 15) return finish(state, state.turn);
  if (legalMoves(state.board, state.turn, state.remaining).length) return { ...state, phase: "move", message: "یک مهره انتخاب کن" };
  const blocked = state.remaining.length > 0;
  const message = blocked ? state.board.bar[state.turn] ? "امکان ورود نداری؛ نوبت منتقل شد" : "حرکت قانونی باقی نمانده؛ نوبت منتقل شد" : "نوبت کامل شد";
  return { ...state, turn: opponent(state.turn), phase: "roll", remaining: [], history: [], selected: null, turnNumber: state.turnNumber + 1, message };
}
export type GameAction =
  | { type: "roll"; dice: [number, number]; revision: number }
  | { type: "select"; from: Source | null; revision: number }
  | { type: "move"; move: Move; revision: number }
  | { type: "undo" | "offerDouble" | "acceptDouble" | "rejectDouble" | "nextGame" | "timeout"; revision: number };
/** Every command carries the revision it was issued against. Replays / stale
 * double clicks are rejected atomically, including roll and turn transitions. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.revision !== state.revision) return state;
  let next = state;
  switch (action.type) {
    case "roll": {
      if (!["opening", "roll"].includes(state.phase) || action.dice.some(d => !Number.isInteger(d) || d < 1 || d > 6)) return state;
      const [a, b] = action.dice;
      if (state.phase === "opening" && a === b) next = { ...state, dice: action.dice, message: "تاس شروع برابر شد؛ دوباره تاس بریز" };
      else next = continueOrPass({ ...state, turn: state.phase === "opening" ? a > b ? "light" : "dark" : state.turn,
        dice: [...action.dice], remaining: expandDice(action.dice), usedDice: [], selected: null, history: [] });
      break;
    }
    case "select": {
      if (state.phase !== "move") return state;
      const from = action.from;
      if (from !== null && (from === "bar" ? !state.board.bar[state.turn] : state.board.bar[state.turn] > 0 || state.board.points[from]?.side !== state.turn)) return state;
      next = { ...state, selected: state.selected === from ? null : from }; break;
    }
    case "move": {
      if (state.phase !== "move" || state.selected !== action.move.from) return state;
      const move = legalMoves(state.board, state.turn, state.remaining).find(m => m.from === action.move.from && m.to === action.move.to && m.die === action.move.die);
      if (!move) return state;
      next = continueOrPass({ ...state, board: applyStep(state.board, state.turn, move), remaining: withoutDie(state.remaining, move.die),
        selected: null, usedDice: [...state.usedDice, move.die], history: [...state.history, { board: state.board, remaining: state.remaining, usedDice: state.usedDice }] }); break;
    }
    case "undo": {
      if (!canUndo(state)) return state;
      const snapshot = state.history[state.history.length - 1];
      next = { ...state, ...snapshot, history: state.history.slice(0, -1), selected: null, message: "حرکت برگشت؛ یک مهره انتخاب کن" }; break;
    }
    case "offerDouble": if (canDouble(state)) next = { ...state, phase: "double", message: "حریف: دوبل را می‌پذیری؟" }; break;
    case "acceptDouble": if (state.phase === "double") next = { ...state, phase: "roll", cube: state.cube * 2, cubeOwner: opponent(state.turn), message: "دوبل پذیرفته شد؛ تاس بریز" }; break;
    case "rejectDouble": if (state.phase === "double") next = finish(state, state.turn, true); break;
    case "timeout": {
      if (state.phase === "finished") return state;
      next = { ...state, turn: opponent(state.turn), phase: "roll", remaining: [], history: [], selected: null, turnNumber: state.turnNumber + 1, message: "زمان تمام شد؛ نوبت منتقل شد" };
      break;
    }
    case "nextGame": {
      if (state.phase !== "finished" || !state.target || Math.max(state.scores.light, state.scores.dark) >= state.target) return state;
      const crawford = !state.crawfordUsed && Math.max(state.scores.light, state.scores.dark) === state.target - 1;
      next = { ...newGame(state.target, state.result?.winner ?? null), scores: { ...state.scores }, crawford, crawfordUsed: state.crawfordUsed || crawford }; break;
    }
  }
  return next === state ? state : { ...next, revision: state.revision + 1 };
}
