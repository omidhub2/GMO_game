import { opponent, type Side } from "./backgammon";

export type Seat = "requester" | "guest";
export const otherSeat = (seat: Seat): Seat => seat === "requester" ? "guest" : "requester";
export interface LobbyState {
  colors: Record<Seat, Side | null>;
  ready: Record<Seat, boolean>;
  swapRequestedBy: Seat | null;
  started: boolean;
  revision: number;
}
export const newLobby = (): LobbyState => ({ colors: { requester: null, guest: null }, ready: { requester: false, guest: false }, swapRequestedBy: null, started: false, revision: 0 });
export const canStart = (s: LobbyState) => !s.started && !!s.colors.requester && !!s.colors.guest && s.ready.requester && s.ready.guest && !s.swapRequestedBy;
export type LobbyAction = { revision: number; actor: Seat } & (
  | { type: "choose"; color: Side }
  | { type: "ready" | "requestSwap" | "acceptSwap" | "rejectSwap" | "cancelSwap" | "start" }
);
/** Seats represent participants, not checker colors. The original requester
 * retains first choice even if their chosen color loses the opening roll. */
export function lobbyReducer(state: LobbyState, action: LobbyAction): LobbyState {
  if (state.started || action.revision !== state.revision) return state;
  let next = state;
  switch (action.type) {
    case "choose":
      if (action.actor !== "requester" || state.colors.requester || !["light", "dark"].includes(action.color)) return state;
      next = { ...state, colors: { requester: action.color, guest: opponent(action.color) } }; break;
    case "ready":
      if (!state.colors[action.actor] || state.swapRequestedBy) return state;
      next = { ...state, ready: { ...state.ready, [action.actor]: !state.ready[action.actor] } }; break;
    case "requestSwap":
      if (!state.colors.requester || state.swapRequestedBy) return state;
      next = { ...state, swapRequestedBy: action.actor }; break;
    case "acceptSwap":
      if (!state.swapRequestedBy || state.swapRequestedBy === action.actor) return state;
      next = { ...state, colors: { requester: state.colors.guest, guest: state.colors.requester }, ready: { requester: false, guest: false }, swapRequestedBy: null }; break;
    case "rejectSwap":
      if (!state.swapRequestedBy || state.swapRequestedBy === action.actor) return state;
      next = { ...state, swapRequestedBy: null }; break;
    case "cancelSwap":
      if (state.swapRequestedBy !== action.actor) return state;
      next = { ...state, swapRequestedBy: null }; break;
    case "start":
      if (action.actor !== "requester" || !canStart(state)) return state;
      next = { ...state, started: true }; break;
  }
  return next === state ? state : { ...next, revision: state.revision + 1 };
}
