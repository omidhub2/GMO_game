// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackgammonGame from "./backgammon-game";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));
let root: Root;
let container: HTMLDivElement;
let rolls: number[];
function button(text: string) {
  const found = [...container.querySelectorAll("button")].find(b => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);
  expect(found, text).toBeDefined(); return found!;
}
function point(index: number) { return container.querySelector<HTMLButtonElement>(`[data-point="${index}"]`)!; }
function click(el: HTMLElement) { act(() => el.click()); }
function settle() { act(() => vi.advanceTimersByTime(1100)); }
function roll() { click(container.querySelector<HTMLButtonElement>("[data-dice-box]")!); settle(); }
function start() {
  click(button("انتخاب سفید"));
  click(button("تأیید سیاه"));
  click(button("ورود به بازی"));
}

beforeEach(() => {
  vi.useFakeTimers();
  rolls = [5, 2];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
    (array as Uint8Array)[0] = (rolls.shift() ?? 3) - 1;
    return array;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(React.createElement(BackgammonGame)));
  start();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Backgammon dice and turn UI", () => {
  it("rolls when any part of the full dice stage, including the adjacent checker prompt, is clicked", () => {
    rolls = [3, 2];
    const stage = container.querySelector<HTMLButtonElement>("[data-dice-hit-area='full-stage']");
    expect(stage).not.toBeNull();
    expect(stage!.querySelector("[data-turn-prompt] i")).not.toBeNull();
    click(stage!.querySelector<HTMLElement>("[data-turn-prompt] i")!);
    expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
    expect(stage!.getAttribute("data-stage")).toBe("settling");
    settle();

    // Re-query after React has committed the updated game state.
    const settledStage = container.querySelector<HTMLButtonElement>("[data-dice-hit-area='full-stage']")!;
    click(settledStage);
    expect(crypto.getRandomValues).toHaveBeenCalledTimes(4);
    settle();
  });

  it("shows the current player's turn directly beneath that player's checker and follows the turn", () => {
    rolls = [3, 2];
    roll();
    expect(container.querySelector("[data-active-turn='light']")?.textContent).toBe("نوبت سفید است");
    expect(container.querySelector("[data-active-turn='light']")?.parentElement?.hasAttribute("data-stats-checker-group")).toBe(true);
    expect(container.querySelector("[data-active-turn='dark']")).toBeNull();

    click(point(23)); click(point(18)); settle();
    click(point(12)); click(point(10)); settle();
    expect(container.querySelector("[data-active-turn='dark']")?.textContent).toBe("نوبت سیاه است");
    expect(container.querySelector("[data-active-turn='dark']")?.parentElement?.classList.contains("statsCheckerGroup")).toBe(true);
    expect(container.querySelector("[data-active-turn='light']")).toBeNull();
  });

  it("keeps double-roll information out of the bottom footer so the board layout does not grow", () => {
    rolls = [5, 2];
    roll();
    click(point(23)); click(point(18)); settle();
    click(point(12)); click(point(10)); settle();
    rolls = [3, 3];
    roll();
    expect(container.querySelectorAll('[aria-label*="تاس ۳"]')).toHaveLength(4);
    const footer = container.querySelector<HTMLElement>(".playFooter");
    expect(footer).not.toBeNull();
    expect(footer!.textContent).not.toContain("جفت");
    expect(footer!.querySelector(".doubleProgress")).toBeNull();
    expect(container.querySelector(".gameToast")?.textContent).not.toContain("جفت");
  });
});
