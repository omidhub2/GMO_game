import type { GameState } from "./backgammon";
import type { LobbyState, Seat } from "./backgammon-lobby";

export type PlayMode = "local" | "computer" | "online";
export interface OnlineCredentials { room: string; token: string }
export interface ChatMessage { id: string; seat: Seat; text: string; createdAt: number }
export interface OnlineSnapshot {
  lobby: LobbyState;
  target: number | null;
  game: GameState | null;
  seat: Seat;
  joined: boolean;
  messages?: ChatMessage[];
}
export interface GameSession {
  lobby: LobbyState;
  target: number | null;
  playMode: PlayMode;
  online?: OnlineCredentials;
  snapshot?: OnlineSnapshot;
}
