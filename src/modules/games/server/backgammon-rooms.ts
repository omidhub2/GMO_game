import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { gameReducer, newGame, type GameAction } from "../domain/backgammon";
import { canStart, lobbyReducer, newLobby, type Seat } from "../domain/backgammon-lobby";
import type { OnlineSnapshot } from "../domain/backgammon-session";

interface Room {
  lobby: OnlineSnapshot["lobby"];
  target: number | null;
  game: OnlineSnapshot["game"];
  tokens: Record<Seat, string | null>;
  expires: number;
  turnStartedAt: number;
}
// Development rooms belong to this server process and expire after six hours.
const shared = globalThis as typeof globalThis & { backgammonRooms?: Map<string, Room> };
const rooms = shared.backgammonRooms ??= new Map();
export class RoomError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function createRoom(color: "light" | "dark", target: number | null) {
  for (const [key, room] of rooms) if (room.expires < Date.now()) rooms.delete(key);
  if (rooms.size >= 1000) throw new RoomError("ظرفیت اتاق‌ها تکمیل است؛ بعداً تلاش کن.", 503);
  let lobby = newLobby();
  lobby = lobbyReducer(lobby, { type: "choose", color, actor: "requester", revision: lobby.revision });
  lobby = lobbyReducer(lobby, { type: "ready", actor: "requester", revision: lobby.revision });
  const id = randomUUID(), token = randomUUID();
  rooms.set(id, { lobby, target, game: null, tokens: { requester: token, guest: null }, expires: Date.now() + 6 * 3600_000, turnStartedAt: Date.now() });
  return { room: id, token };
}
function getRoom(id: string) {
  const room = rooms.get(id);
  if (!room || room.expires < Date.now()) { rooms.delete(id); throw new RoomError("اتاق پیدا نشد یا منقضی شده است؛ دعوت تازه بساز.", 404); }
  return room;
}
function participant(room: Room, token: string): Seat {
  if (token && room.tokens.requester === token) return "requester";
  if (token && room.tokens.guest === token) return "guest";
  throw new RoomError("دسترسی به این اتاق معتبر نیست.", 403);
}
export function joinRoom(id: string) {
  const room = getRoom(id);
  if (room.tokens.guest) throw new RoomError("این اتاق دو بازیکن دارد.", 409);
  room.tokens.guest = randomUUID();
  return { room: id, token: room.tokens.guest };
}
export function roomSnapshot(id: string, token: string): OnlineSnapshot {
  const room = getRoom(id), seat = participant(room, token);
  return { lobby: room.lobby, target: room.target, game: room.game, seat, joined: !!room.tokens.guest };
}
export function readyRoom(id: string, token: string) {
  const room = getRoom(id), seat = participant(room, token);
  if (seat === "guest" && !room.lobby.ready.guest) room.lobby = lobbyReducer(room.lobby, { type: "ready", actor: seat, revision: room.lobby.revision });
  if (canStart(room.lobby)) {
    room.lobby = lobbyReducer(room.lobby, { type: "start", actor: "requester", revision: room.lobby.revision });
    room.game = newGame(room.target);
    room.turnStartedAt = Date.now();
  }
  return roomSnapshot(id, token);
}
export function roomAction(id: string, token: string, action: GameAction) {
  const room = getRoom(id), seat = participant(room, token), state = room.game;
  if (!state) throw new RoomError("بازی هنوز شروع نشده است.", 409);
  const side = room.lobby.colors[seat];
  if (action.type === "timeout") {
    if (state.phase !== "move" || Date.now() - room.turnStartedAt < 30_000) throw new RoomError("زمان نوبت هنوز تمام نشده است.", 409);
  } else {
    const allowed = state.phase === "opening" || state.phase === "finished"
      ? seat === "requester" : state.phase === "double" ? side !== state.turn : side === state.turn;
    if (!allowed) throw new RoomError("منتظر نوبت خودت بمان.", 403);
  }
  // The server owns dice; clients cannot choose their outcome.
  if (action.type === "roll") action = { ...action, dice: [randomInt(1, 7), randomInt(1, 7)] };
  const next = gameReducer(state, action);
  if (next === state) throw new RoomError("وضعیت بازی تغییر کرده است؛ دوباره تلاش کن.", 409);
  room.game = next;
  if ((action.type === "roll" && next.phase === "move") || next.turn !== state.turn || next.turnNumber !== state.turnNumber) room.turnStartedAt = Date.now();
  return roomSnapshot(id, token);
}
