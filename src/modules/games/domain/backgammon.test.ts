import { describe, expect, it } from "vitest";
import { canBearOff, canDouble, canUndo, expandDice, gameReducer, initialBoard, legalMoves, newGame, pointNumber, singleDieMoves, winMultiplier, type Board, type GameAction, type GameState, type Move, type Side } from "./backgammon";

function position(light: Record<number, number>, dark: Record<number, number> = {}, bar = { light: 0, dark: 0 }): Board {
  const board: Board = { points: Array(24).fill(null), bar, off: { light: 0, dark: 0 } };
  for (const [side, checkers] of [["light", light], ["dark", dark]] as const) {
    let total = bar[side];
    for (const [n, count] of Object.entries(checkers)) { board.points[Number(n) - 1] = { side, count }; total += count; }
    board.off[side] = 15 - total;
  }
  return board;
}
function ready(board = initialBoard(), dice: [number, number] = [3, 2], side: Side = "light"): GameState {
  return { ...newGame(), board, phase: "move", turn: side, dice, remaining: expandDice(dice) };
}
function command(state: GameState, type: "undo" | "offerDouble" | "acceptDouble" | "rejectDouble" | "nextGame") {
  return gameReducer(state, { type, revision: state.revision });
}
function play(state: GameState, move: Move): GameState {
  const selected = gameReducer(state, { type: "select", from: move.from, revision: state.revision });
  return gameReducer(selected, { type: "move", move, revision: selected.revision });
}
function find(state: GameState, from: number | "bar", die: number, to?: number | "off"): Move {
  const m = legalMoves(state.board, state.turn, state.remaining).find(m => m.from === from && m.die === die && (to === undefined || m.to === to));
  expect(m, `expected move ${from}/${die}/${to}`).toBeDefined(); return m!;
}
function mirror(board: Board): Board {
  return { points: [...board.points].reverse().map(p => p && { ...p, side: p.side === "light" ? "dark" : "light" }), bar: { light: board.bar.dark, dark: board.bar.light }, off: { light: board.off.dark, dark: board.off.light } };
}
function assertTotals(board: Board) {
  for (const side of ["light", "dark"] as const) {
    expect(board.points.reduce((n, p) => n + (p?.side === side ? p.count : 0), 0) + board.bar[side] + board.off[side]).toBe(15);
    expect(board.points.every(p => !p || Number.isInteger(p.count) && p.count > 0)).toBe(true);
  }
}

describe("standard board and dice", () => {
  it("starts with 15 each, mirrored standard setup and opposing directions", () => {
    const board = initialBoard(); assertTotals(board); expect(mirror(board)).toEqual(board);
    expect([24, 13, 8, 6].map(n => board.points[n - 1]?.count)).toEqual([2,5,3,5]);
    expect(pointNumber(23, "light")).toBe(24); expect(pointNumber(0, "dark")).toBe(24);
  });
  it("repeats tied opening rolls, then uses those same two dice and waits for selection", () => {
    let s = newGame(); s = gameReducer(s, {type:"roll",dice:[4,4],revision:0});
    expect(s.phase).toBe("opening"); expect(s.remaining).toEqual([]);
    s = gameReducer(s, {type:"roll",dice:[2,5],revision:s.revision});
    expect(s.turn).toBe("dark"); expect(s.dice).toEqual([2,5]); expect(s.remaining).toEqual([2,5]);
    expect(s.selected).toBeNull(); expect(s.board).toEqual(initialBoard()); expect(s.message).toBe("یک مهره انتخاب کن");
    expect(gameReducer(s,{type:"roll",dice:[6,6],revision:s.revision})).toBe(s);
  });
  it("rejects stale rolls, malformed dice and out-of-turn actions", () => {
    const s = newGame(); const action: GameAction = {type:"roll",dice:[6,1],revision:0};
    const rolled = gameReducer(s, action); expect(gameReducer(rolled,action)).toBe(rolled);
    expect(gameReducer(s,{type:"roll",dice:[0,7],revision:0})).toBe(s);
    expect(command(s,"undo")).toBe(s);
  });
});

describe("maximal legal sequences", () => {
  it("filters a locally legal first step that would waste the other die", () => {
    // With one checker on 2, 1 then 2 consumes both. 2/off wastes the 1.
    const b = position({2:1});
    expect(singleDieMoves(b,"light",2)).toContainEqual({from:1,to:"off",die:2,hit:false});
    expect(legalMoves(b,"light",[1,2])).toEqual([{from:1,to:0,die:1,hit:false}]);
  });
  it("requires the higher number when either die works but only one can be used", () => {
    expect(legalMoves(position({1:1}),"light",[1,6])).toEqual([{from:0,to:"off",die:6,hit:false}]);
  });
  it("allows the lower die when the higher cannot be played", () => {
    const b = position({}, {19:2}, {light:1,dark:0});
    expect(legalMoves(b,"light",[1,6])).toEqual([{from:"bar",to:23,die:1,hit:false}]);
  });
  it("does not wrap around the board or impose a five-checker cap", () => {
    const b = position({6:10,8:5}, {24:15});
    expect(singleDieMoves(b,"light",2)).toContainEqual({from:7,to:5,die:2,hit:false});
    expect(singleDieMoves(position({1:1,8:14}),"light",2).some(m=>m.from===0)).toBe(false);
  });
  it("allows jumping over a block but forbids landing on it", () => {
    const b = position({8:15},{7:2,6:2,24:11});
    expect(singleDieMoves(b,"light",1)).toEqual([]);
    expect(singleDieMoves(b,"light",3)).toEqual([{from:7,to:4,die:3,hit:false}]);
  });
  it.each([0,1,2,3,4])("plays exactly %i possible double steps then passes once", count => {
    const blockedNumber = count === 4 ? 1 : 24-count;
    const b = count === 4 ? position({24:1},{1:15}) : position({}, {[blockedNumber]:15}, {light:1,dark:0});
    let s = { ...newGame(), phase:"roll" as const, board:b } as GameState;
    s = gameReducer(s,{type:"roll",dice:[1,1],revision:s.revision});
    let played=0;
    while(s.phase === "move") { const m = legalMoves(s.board,s.turn,s.remaining)[0]; s=play(s,m); played++; expect(played).toBeLessThanOrEqual(4); }
    expect(played).toBe(count); expect(s.turn).toBe("dark"); expect(s.turnNumber).toBe(2);
    expect(canUndo(s)).toBe(false); assertTotals(s.board);
  });
});

describe("manual input and undo transaction boundaries", () => {
  it("selects without moving, changes selection, deselects, rejects invalid destinations", () => {
    let s = ready(); const original = s.board;
    s = gameReducer(s,{type:"select",from:23,revision:s.revision});
    expect(s.board).toBe(original); expect(s.selected).toBe(23);
    expect(legalMoves(s.board,s.turn,s.remaining).filter(m=>m.from===23).map(m=>m.to).sort()).toEqual([20,21]);
    s = gameReducer(s,{type:"select",from:12,revision:s.revision}); expect(s.selected).toBe(12);
    const invalid = gameReducer(s,{type:"move",move:{from:12,to:0,die:3,hit:false},revision:s.revision}); expect(invalid).toBe(s);
    s = gameReducer(s,{type:"select",from:12,revision:s.revision}); expect(s.selected).toBeNull();
  });
  it("undoes the first regular move with fixed dice; locks after the second", () => {
    const initial = ready(); let s=play(initial,find(initial,23,3));
    expect(canUndo(s)).toBe(true); const undo=command(s,"undo");
    expect(undo.board).toEqual(initial.board); expect(undo.remaining).toEqual([3,2]); expect(undo.dice).toEqual([3,2]); expect(undo.selected).toBeNull();
    s=play(s,legalMoves(s.board,s.turn,s.remaining)[0]);
    expect(s.phase).toBe("roll"); expect(canUndo(s)).toBe(false); expect(command(s,"undo")).toBe(s);
  });
  it("undoes doubles step by step through three moves; fourth commits", () => {
    const initial=ready(initialBoard(),[3,3]); let s=initial;
    for(let i=1;i<=3;i++) { s=play(s,legalMoves(s.board,s.turn,s.remaining)[0]); expect(canUndo(s)).toBe(true); expect(s.remaining).toHaveLength(4-i); }
    const afterThree=s;
    for(let i=2;i>=0;i--) { s=command(s,"undo"); expect(s.history).toHaveLength(i); }
    expect(s.board).toEqual(initial.board); expect(s.usedDice).toEqual([]); expect(s.remaining).toEqual([3,3,3,3]);
    s=play(afterThree,legalMoves(afterThree.board,afterThree.turn,afterThree.remaining)[0]); expect(s.phase).toBe("roll"); expect(canUndo(s)).toBe(false);
  });
  it("closes undo immediately when a turn ends early", () => {
    let s=ready(position({}, {19:2,18:13},{light:1,dark:0}),[1,6]);
    s=play(s,find(s,"bar",1)); expect(s.phase).toBe("roll"); expect(s.usedDice).toEqual([1]); expect(canUndo(s)).toBe(false);
  });
  it("exactly restores hit blot, stacked destination, Bar, dice and selection", () => {
    const initial=ready(position({8:2,13:13},{5:1,24:14}),[3,2]);
    const hit=play(initial,find(initial,7,3)); expect(hit.board.bar.dark).toBe(1); assertTotals(hit.board);
    const undone=command(hit,"undo"); expect(undone.board).toEqual(initial.board); expect(undone.usedDice).toEqual([]); expect(undone.selected).toBeNull();
    const stackInitial=ready(position({6:5,8:10},{24:15}),[2,1]);
    const stacked=play(stackInitial,find(stackInitial,7,2)); expect(stacked.board.points[5]?.count).toBe(6);
    expect(command(stacked,"undo").board).toEqual(stackInitial.board);
  });
  it("restores borne off checker and exact consumed oversize die", () => {
    const initial=ready(position({5:2}),[6,1]);
    const moved=play(initial,find(initial,4,6,"off")); expect(moved.board.off.light).toBe(14);
    const undone=command(moved,"undo"); expect(undone.board).toEqual(initial.board); expect(undone.remaining).toEqual([6,1]);
  });
  it("rejects repeated move commands without consuming another die or passing twice", () => {
    let s=ready(); const m=find(s,23,3);
    s=gameReducer(s,{type:"select",from:m.from,revision:s.revision});
    const action: GameAction={type:"move",move:m,revision:s.revision};
    const next=gameReducer(s,action); expect(gameReducer(next,action)).toBe(next); expect(next.usedDice).toEqual([3]);
  });
});

describe("Bar and bearing off", () => {
  it("requires all Bar checkers to enter before normal moves, hits on entry and continues", () => {
    let s=ready(position({8:13},{24:1,12:14},{light:2,dark:0}),[1,1]);
    expect(legalMoves(s.board,s.turn,s.remaining).every(m=>m.from==="bar")).toBe(true);
    const start=s; s=play(s,find(s,"bar",1)); expect(s.board.bar).toEqual({light:1,dark:1});
    expect(command(s,"undo").board).toEqual(start.board);
    s=play(s,find(s,"bar",1)); expect(s.board.bar.light).toBe(0);
    expect(legalMoves(s.board,s.turn,s.remaining).some(m=>m.from===23)).toBe(true); assertTotals(s.board);
  });
  it("passes automatically with the entry blocked", () => {
    const b=position({}, {24:2,23:2,12:11},{light:1,dark:0});
    const s=gameReducer({...newGame(),board:b,phase:"roll"},{type:"roll",dice:[1,2],revision:0});
    expect(s.phase).toBe("roll"); expect(s.turn).toBe("dark"); expect(s.message).toContain("امکان ورود نداری"); expect(s.history).toEqual([]);
  });
  it("requires all checkers home, including an empty Bar", () => {
    expect(canBearOff(position({6:14,7:1}),"light")).toBe(false);
    expect(canBearOff(position({6:14},{},{light:1,dark:0}),"light")).toBe(false);
    expect(canBearOff(position({6:15}),"light")).toBe(true);
  });
  it("allows exact exits and overshoots only from the highest occupied point", () => {
    const b=position({4:5,5:10});
    expect(singleDieMoves(b,"light",6)).toEqual([{from:4,to:"off",die:6,hit:false}]);
    expect(singleDieMoves(b,"light",4)).toContainEqual({from:3,to:"off",die:4,hit:false});
    expect(singleDieMoves(b,"light",1).some(m=>m.to!=="off")).toBe(true);
  });
  it("ends immediately on the fifteenth checker without allowing undo", () => {
    let s=ready(position({2:1},{24:15}),[1,2]); s=play(s,find(s,1,1));
    s=play(s,find(s,0,2)); expect(s.phase).toBe("finished"); expect(s.board.off.light).toBe(15);
    expect(canUndo(s)).toBe(false); expect(command(s,"undo")).toBe(s); assertTotals(s.board);
  });
  it("allows continuing the same checker after hitting; re-entry suspends bearing off", () => {
    let s=ready(position({8:15},{5:1,24:14}),[3,2]); s=play(s,find(s,7,3));
    expect(legalMoves(s.board,"light",s.remaining)).toContainEqual({from:4,to:2,die:2,hit:false});
    expect(canBearOff(s.board,"dark")).toBe(false);
  });
});

describe("scoring, cube and Crawford", () => {
  it("distinguishes normal, gammon, and backgammon including Bar", () => {
    expect(winMultiplier(position({}, {24:14}),"light")).toBe(1);
    expect(winMultiplier(position({}, {24:15}),"light")).toBe(2);
    expect(winMultiplier(position({}, {6:1,24:14}),"light")).toBe(3);
    expect(winMultiplier(position({}, {24:14},{light:0,dark:1}),"light")).toBe(3);
  });
  it("only offers before rolling on the offerer's turn, transfers ownership on accept", () => {
    expect(canDouble(newGame())).toBe(false); expect(canDouble(newGame(5))).toBe(false);
    let s={...newGame(5),phase:"roll" as const} as GameState; expect(canDouble(s)).toBe(true);
    s=command(s,"offerDouble"); expect(s.phase).toBe("double");
    expect(gameReducer(s,{type:"roll",dice:[2,3],revision:s.revision})).toBe(s);
    s=command(s,"acceptDouble"); expect(s.cube).toBe(2); expect(s.cubeOwner).toBe("dark"); expect(s.turn).toBe("light"); expect(canDouble(s)).toBe(false);
    expect(canDouble({...s,turn:"dark"})).toBe(true);
    expect(canDouble({...s,turn:"dark",phase:"move"})).toBe(false);
  });
  it("scores a declined redouble at the old cube value", () => {
    let s={...newGame(9),phase:"roll" as const,cube:4,cubeOwner:"light" as const};
    s=command(command(s,"offerDouble"),"rejectDouble") as typeof s;
    expect(s.result?.points).toBe(4); expect(s.scores.light).toBe(4); expect(s.cube).toBe(4);
  });
  it("multiplies gammon by cube and stops the match at target", () => {
    let s={...ready(position({1:1},{24:15}),[2,2]),target:5,cube:4};
    s=play(s,find(s,0,2)) as typeof s;
    expect(s.result).toEqual({winner:"light",multiplier:2,points:8,dropped:false});
    expect(command(s,"nextGame")).toBe(s);
  });
  it("disables doubles for exactly the next game at one-away, then restores them", () => {
    let s={...newGame(5),phase:"finished" as const,scores:{light:4,dark:0}} as GameState;
    s=command(s,"nextGame"); expect(s.crawford).toBe(true); expect(s.crawfordUsed).toBe(true); expect(s.cube).toBe(1);
    expect(canDouble({...s,phase:"roll"})).toBe(false);
    s=command({...s,phase:"finished",scores:{light:4,dark:1}},"nextGame");
    expect(s.crawford).toBe(false); expect(canDouble({...s,phase:"roll"})).toBe(true);
    expect(newGame(1).crawford).toBe(true);
  });
});

describe("symmetry and conservation", () => {
  it("has identical legal steps for both players across Bar, home and starting positions", () => {
    for(const b of [initialBoard(),position({4:5,5:10},{24:15}),position({8:13},{24:1,12:14},{light:2,dark:0})]) {
      for(let a=1;a<=6;a++) for(let c=1;c<=6;c++) {
        const dice=expandDice([a,c]);
        const expected=legalMoves(b,"light",dice).map(m=>({...m,from:typeof m.from==="number"?23-m.from:m.from,to:typeof m.to==="number"?23-m.to:m.to}));
        expect(legalMoves(mirror(b),"dark",dice)).toEqual(expect.arrayContaining(expected));
        expect(legalMoves(mirror(b),"dark",dice)).toHaveLength(expected.length);
      }
    }
  });
  it("keeps 15 per player through complete seeded games with hits, entries, exits and undos", () => {
    let seed=31567; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
    for(let game=0;game<3;game++) {
      let s=newGame(); let steps=0;
      while(s.phase!=="finished" && steps++<4000) {
        assertTotals(s.board);
        if(s.phase==="opening" || s.phase==="roll") s=gameReducer(s,{type:"roll",dice:[random()%6+1,random()%6+1],revision:s.revision});
        else {
          const moves=legalMoves(s.board,s.turn,s.remaining); expect(moves.length).toBeGreaterThan(0);
          s=play(s,moves[random()%moves.length]);
          if(canUndo(s) && random()%5===0) { const before=s; s=command(s,"undo"); assertTotals(s.board); expect(s.dice).toEqual(before.dice); }
        }
      }
      expect(s.phase).toBe("finished"); assertTotals(s.board);
    }
  },30000);
});
