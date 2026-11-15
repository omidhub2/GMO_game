import { legalMoves, pointNumber, type GameState } from "./backgammon";

/** A small deterministic opponent; all candidates obey mandatory dice use. */
export function computerMove(state: GameState) {
  const score = (move: ReturnType<typeof legalMoves>[number]) => {
    if (move.to === "off") return 100;
    const target = state.board.points[move.to];
    const source = move.from === "bar" ? null : state.board.points[move.from];
    return (move.hit ? 30 : 0) + (target?.side === state.turn && target.count === 1 ? 15 : 0)
      - (source?.count === 2 ? 8 : 0) - (!target ? 4 : 0)
      + move.die + (pointNumber(move.to, state.turn) <= 6 ? 2 : 0);
  };
  return legalMoves(state.board, state.turn, state.remaining).sort((a, b) => score(b) - score(a))[0] ?? null;
}
