import { describe, expect, it } from "vitest";
import { canStart, lobbyReducer, newLobby, type LobbyAction, type LobbyState, type Seat } from "./backgammon-lobby";
const act = (s: LobbyState, type: "ready" | "requestSwap" | "acceptSwap" | "rejectSwap" | "cancelSwap" | "start", actor: Seat = "requester") => lobbyReducer(s,{type,actor,revision:s.revision});
const choose = (color: "light" | "dark") => lobbyReducer(newLobby(),{type:"choose",actor:"requester",color,revision:0});
describe("pregame seat and color agreement", () => {
  it.each(["light","dark"] as const)("reserves the opposite color after requester picks %s", color => {
    const s=choose(color); expect(s.colors.requester).toBe(color); expect(s.colors.guest).toBe(color === "light" ? "dark" : "light");
  });
  it("gives first choice only to original requester; readiness cannot bypass choice", () => {
    const s=newLobby();
    expect(lobbyReducer(s,{type:"choose",actor:"guest",color:"light",revision:0})).toBe(s);
    expect(act(s,"ready")).toBe(s); expect(canStart(s)).toBe(false);
    const chosen=choose("dark"); expect(lobbyReducer(chosen,{type:"choose",actor:"requester",color:"light",revision:chosen.revision})).toBe(chosen);
  });
  it("requires both confirmations, then locks all lobby changes", () => {
    let s=choose("light");s=act(s,"ready"); expect(canStart(s)).toBe(false); s=act(s,"ready","guest");expect(canStart(s)).toBe(true);
    expect(act(s,"start","guest")).toBe(s);s=act(s,"start");expect(s.started).toBe(true);expect(act(s,"requestSwap")).toBe(s);expect(act(s,"ready")).toBe(s);
  });
  it.each(["requester","guest"] as const)("swaps only after the other seat accepts %s's request", actor => {
    let s=act(act(choose("dark"),"ready"),"ready","guest");const before=s.colors;
    s=act(s,"requestSwap",actor);expect(s.colors).toEqual(before);expect(canStart(s)).toBe(false);
    expect(act(s,"acceptSwap",actor)).toBe(s);expect(act(s,"ready",actor)).toBe(s);
    s=act(s,"acceptSwap",actor === "requester" ? "guest" : "requester");expect(s.colors).toEqual({requester:"light",guest:"dark"});expect(s.ready).toEqual({requester:false,guest:false});
  });
  it("keeps assignments and readiness intact on rejection or cancellation", () => {
    const base=act(act(choose("light"),"ready"),"ready","guest"); const pending=act(base,"requestSwap");
    for(const s of [act(pending,"rejectSwap","guest"),act(pending,"cancelSwap")]){expect(s.colors).toEqual(base.colors);expect(s.ready).toEqual(base.ready);expect(canStart(s)).toBe(true);}
    expect(act(pending,"rejectSwap")).toBe(pending);expect(act(pending,"cancelSwap","guest")).toBe(pending);
  });
  it("rejects stale repeated acceptance instead of swapping back", () => {
    const s=act(choose("light"),"requestSwap");const action: LobbyAction={type:"acceptSwap",actor:"guest",revision:s.revision};
    const accepted=lobbyReducer(s,action);expect(lobbyReducer(accepted,action)).toBe(accepted);
  });
});
