// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackgammonGame from "./backgammon-game";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));
let root: Root, container: HTMLDivElement;
function choose(label: string) {
  const node = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(node, label).not.toBeNull(); act(() => node!.click());
}
function button(label: string) {
  const node = [...container.querySelectorAll("button")].find(button => button.textContent?.trim() === label);
  expect(node, label).toBeDefined(); act(() => node!.click());
}
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
beforeEach(() => {
  vi.useFakeTimers(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/games/backgammon");
  const values = [5, 1];
  vi.spyOn(crypto, "getRandomValues").mockImplementation(array => { (array as Uint8Array)[0] = values.shift() ?? 2; return array; });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(React.createElement(BackgammonGame)));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("backgammon mode selection", () => {
  it("requires connection and player count before showing the local setup", () => {
    expect(container.querySelector('input[name="connection"]:checked')).toBeNull();
    expect(container.querySelector('[aria-label="انتخاب رنگ مهره‌ها"]')).toBeNull();
    choose("آفلاین");
    expect(container.querySelector('input[name="players"]:checked')).toBeNull();
    expect(container.querySelector('[aria-label="انتخاب رنگ مهره‌ها"]')).toBeNull();
    choose("دونفره روی یک دستگاه"); choose("انتخاب سفید");
    choose("آنلاین");
    expect(container.querySelector('[aria-label="اتاق آنلاین"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="انتخاب رنگ مهره‌ها"]')).toBeNull();
    choose("آفلاین"); choose("دونفره روی یک دستگاه");
    expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
  });
  it.each(["سفید", "سیاه"])("plays the computer turn automatically when the human chooses %s", color => {
    choose("آفلاین"); choose("تک‌نفره با کامپیوتر"); choose(`انتخاب ${color}`);
    expect(container.textContent).toContain(`کامپیوتر: ${color === "سفید" ? "سیاه" : "سفید"}`);
    button("ورود به بازی");
    expect(container.querySelector('[data-play-mode="computer"]')).not.toBeNull();
    choose("تاس شروع"); advance(900);
    if (color === "سفید") {
      // Opening dice are 6 and 2; the human completes both moves.
      act(() => container.querySelector<HTMLButtonElement>('[data-point="23"]')!.click());
      act(() => container.querySelector<HTMLButtonElement>('[data-point="17"]')!.click()); advance(240);
      act(() => container.querySelector<HTMLButtonElement>('[data-point="12"]')!.click());
      act(() => container.querySelector<HTMLButtonElement>('[data-point="10"]')!.click()); advance(240);
      expect(container.textContent).toContain("نوبت کامپیوتر");
      expect(container.querySelector<HTMLButtonElement>("[data-dice-box]")!.disabled).toBe(true);
      advance(700); // Computer rolls.
    }
    expect([...container.querySelectorAll<HTMLButtonElement>("[data-point]")].every(point => point.disabled)).toBe(true);
    for (let i = 0; i < 5; i++) advance(700);
    expect(container.querySelector<HTMLButtonElement>("[data-dice-box]")!.disabled).toBe(false);
    expect(container.textContent).not.toContain("نوبت کامپیوتر");
  });
});
