// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BackgammonOnline from "./backgammon-online";
import { newGame } from "@/modules/games/domain/backgammon";
import { newLobby } from "@/modules/games/domain/backgammon-lobby";
import type { OnlineSnapshot } from "@/modules/games/domain/backgammon-session";

let root: Root, container: HTMLDivElement;
const credentials = { room: "d839d2b3-0466-44f4-9324-a413077145c4", token: "test-participant-token" };
const snapshot: OnlineSnapshot = { lobby: { ...newLobby(), colors: { requester: "light", guest: "dark" }, ready: { requester: true, guest: false } }, target: null, game: null, seat: "requester", joined: false };
const onStart = vi.fn();
const respond = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
async function render() { await act(async () => root.render(React.createElement(BackgammonOnline, { onStart }))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
beforeEach(() => {
  vi.useFakeTimers(); onStart.mockReset(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/games/backgammon"); sessionStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("creates an online invitation, then starts with the synchronized game", async () => {
  let current = snapshot;
  const fetchMock = vi.fn((_url: string, options?: RequestInit) => respond(options?.method === "POST" ? credentials : current));
  vi.stubGlobal("fetch", fetchMock);
  await render(); await click("ساخت اتاق آنلاین");
  expect(container.querySelector<HTMLInputElement>("input[readonly]")!.value).toContain(`room=${credentials.room}`);
  expect(sessionStorage.getItem(`backgammon-room-${credentials.room}`)).toBe(credentials.token);
  expect(onStart).not.toHaveBeenCalled();
  current = { ...snapshot, joined: true, game: newGame() };
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ playMode: "online", online: credentials, snapshot: current }));
});
it("restores a participant after refresh without claiming another seat", async () => {
  window.history.replaceState(null, "", `?room=${credentials.room}`);
  sessionStorage.setItem(`backgammon-room-${credentials.room}`, credentials.token);
  const fetchMock = vi.fn(() => respond({ ...snapshot, joined: true, game: newGame() }));
  vi.stubGlobal("fetch", fetchMock);
  await render();
  expect(onStart).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(credentials.room), expect.any(Object));
});
it("joins an invitation and requires the guest's confirmation", async () => {
  window.history.replaceState(null, "", `?room=${credentials.room}`);
  let current = { ...snapshot, seat: "guest", joined: true };
  const fetchMock = vi.fn((_url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (body?.operation === "join") return respond(credentials);
    if (body?.operation === "ready") current = { ...current, game: newGame() };
    return respond(current);
  });
  vi.stubGlobal("fetch", fetchMock);
  await render(); await click("پیوستن به اتاق");
  expect(onStart).not.toHaveBeenCalled();
  await click("تأیید رنگ و شروع بازی");
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(onStart).toHaveBeenCalledOnce();
});
it("shows connection errors and allows retrying", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond({ error: "اتاق در دسترس نیست" }, 503)));
  await render(); await click("ساخت اتاق آنلاین");
  expect(container.querySelector('[role="alert"]')!.textContent).toBe("اتاق در دسترس نیست");
  expect([...container.querySelectorAll("button")].find(button => button.textContent === "ساخت اتاق آنلاین")!.disabled).toBe(false);
});
