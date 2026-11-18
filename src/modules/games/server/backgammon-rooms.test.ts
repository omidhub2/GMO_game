import { describe, expect, it, vi } from "vitest";
import { createRoom, joinRoom, readyRoom, roomAction, roomSnapshot } from "./backgammon-rooms";
import { legalMoves } from "../domain/backgammon";

describe("online backgammon rooms", () => {
  it("reserves two seats and starts only after the guest confirms", () => {
    const host = createRoom("dark", 5);
    expect(roomSnapshot(host.room, host.token).game).toBeNull();
    const guest = joinRoom(host.room);
    expect(() => joinRoom(host.room)).toThrow();
    expect(() => roomSnapshot(host.room, "invalid")).toThrow();
    expect(readyRoom(host.room, host.token).game).toBeNull();
    const snapshot = readyRoom(guest.room, guest.token);
    expect(snapshot.game?.phase).toBe("opening");
    expect(snapshot.lobby.colors.guest).toBe("light");
    expect(snapshot.target).toBe(5);
    expect(roomSnapshot(host.room, host.token).game).toEqual(snapshot.game);
  });
  it("owns dice, rejects stale commands and enforces each participant's turn", () => {
    const host = createRoom("light", null), guest = joinRoom(host.room);
    readyRoom(guest.room, guest.token);
    expect(() => roomAction(guest.room, guest.token, { type: "roll", dice: [6,6], revision: 0 })).toThrow();
    let snapshot = roomSnapshot(host.room, host.token);
    // The server may return tied opening dice; repeat with the authoritative revision.
    for (let i = 0; snapshot.game?.phase === "opening" && i < 100; i++) {
      snapshot = roomAction(host.room, host.token, { type: "roll", dice: [0,0], revision: snapshot.game.revision });
    }
    const state = snapshot.game!;
    expect(state.phase).toBe("move");
    expect(state.dice!.every(die => die >= 1 && die <= 6)).toBe(true);
    const active = state.turn === "light" ? host : guest, inactive = state.turn === "light" ? guest : host;
    const move = legalMoves(state.board, state.turn, state.remaining)[0];
    expect(() => roomAction(inactive.room, inactive.token, { type: "select", from: move.from, revision: state.revision })).toThrow();
    const selected = roomAction(active.room, active.token, { type: "select", from: move.from, revision: state.revision });
    expect(() => roomAction(active.room, active.token, { type: "move", move, revision: state.revision })).toThrow();
    const moved = roomAction(active.room, active.token, { type: "move", move, revision: selected.game!.revision });
    expect(moved.game!.usedDice).toHaveLength(1);
    expect(roomSnapshot(inactive.room, inactive.token).game).toEqual(moved.game);
  });
  it("accepts a legal move without a separate server-side selection request", () => {
    const host = createRoom("light", null), guest = joinRoom(host.room);
    readyRoom(guest.room, guest.token);
    let snapshot = roomSnapshot(host.room, host.token);
    for (let i = 0; snapshot.game?.phase === "opening" && i < 100; i++) {
      snapshot = roomAction(host.room, host.token, { type: "roll", dice: [0, 0], revision: snapshot.game!.revision });
    }
    const state = snapshot.game!;
    const move = legalMoves(state.board, state.turn, state.remaining)[0];
    const active = state.turn === "light" ? host : guest;
    const moved = roomAction(active.room, active.token, { type: "move", move, revision: state.revision }, "a8dbf4c7-92de-45f1-b9e8-37aee3f51c5c");
    expect(moved.game!.revision).toBe(state.revision + 2);
    expect(moved.game!.usedDice).toHaveLength(1);
  });
  it("applies an online command once and safely returns the snapshot for retries", () => {
    const host = createRoom("light", null), guest = joinRoom(host.room);
    readyRoom(guest.room, guest.token);
    const commandId = "7b8f4e3a-6f27-4c6f-9e7a-9c0f6a1b2d33";
    const before = roomSnapshot(host.room, host.token).game!;
    const action = { type: "roll" as const, dice: [2, 5] as [number, number], revision: before.revision };
    const accepted = roomAction(host.room, host.token, action, commandId);
    const retried = roomAction(host.room, host.token, action, commandId);
    expect(retried.game).toEqual(accepted.game);
    expect(retried.game!.revision).toBe(accepted.game!.revision);
    expect(() => roomAction(host.room, host.token, { ...action, dice: [3, 4] }, commandId)).toThrow(/شناسه حرکت/);
  });
  it("expires abandoned rooms", () => {
    const host = createRoom("light", null);
    vi.useFakeTimers();
    try { vi.advanceTimersByTime(6 * 3600_000 + 1); expect(() => roomSnapshot(host.room, host.token)).toThrow(); }
    finally { vi.useRealTimers(); }
  });
});
