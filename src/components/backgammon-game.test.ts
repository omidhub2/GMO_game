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
function roll() { click(button("تاس بریز")); settle(); }
function start(mode?: string) {
  click(container.querySelector<HTMLInputElement>('input[name="connection"]')!);
  click(container.querySelectorAll<HTMLInputElement>('input[name="players"]')[1]);
  if (mode) { click(button("ساده؛ بدون دوبل")); click(button(`مسابقه تا ${Number(mode).toLocaleString("fa-IR")} امتیاز`)); }
  click(button("انتخاب سیاه")); click(button("انتخاب سفید")); click(button("ورود به بازی"));
}
function undoButton() {
  click(button("باز کردن منوی بازی"));
  return button("برگشت حرکت");
}
function undoEnabled() {
  const enabled = !undoButton().disabled;
  click(button("بستن منو"));
  return enabled;
}

beforeEach(() => {
  vi.useFakeTimers(); rolls=[5,2];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
  vi.spyOn(crypto,"getRandomValues").mockImplementation((array) => { (array as Uint8Array)[0]=(rolls.shift() ?? 3)-1; return array; });
  container=document.createElement("div"); document.body.append(container); root=createRoot(container);
  act(() => root.render(React.createElement(BackgammonGame)));
  start();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Persian manual board interactions", () => {
  it("waits after dice animation with zero selected checkers and no automatic move", () => {
    const before=[...container.querySelectorAll("[data-point]")].map(p=>p.getAttribute("aria-label"));
    click(button("تاس بریز")); expect(point(23).disabled).toBe(true);
    settle();
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect([...container.querySelectorAll("[data-point]")].map(p=>p.getAttribute("aria-label"))).toEqual(before);
    expect(button("تاس بریز").disabled).toBe(true);
  });
  it("shows every selected checker destination, supports cancellation and blocks invalid moves", () => {
    rolls=[3,2]; roll(); click(point(23));
    expect(point(20).getAttribute("aria-label")).toContain("مقصد مجاز با تاس ۳");
    expect(point(21).getAttribute("aria-label")).toContain("مقصد مجاز با تاس ۲");
    click(point(0)); expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(undoEnabled()).toBe(false);
    click(point(23)); click(point(23)); expect(point(23).getAttribute("aria-pressed")).toBe("false");
    click(point(23)); click(point(12)); expect(point(12).getAttribute("aria-pressed")).toBe("true");
  });
  it("undoes from the center bar and allows a different move until the last die is used", () => {
    rolls=[3,2]; roll();
    const start=point(23).getAttribute("aria-label");
    click(point(23)); click(point(20)); settle();
    const centerUndo=container.querySelector<HTMLButtonElement>("[data-undo-bar]");
    expect(centerUndo).not.toBeNull();
    expect(centerUndo!.disabled).toBe(false);
    expect(centerUndo!.closest("div")?.className).toContain("bar");
    click(centerUndo!);
    expect(point(23).getAttribute("aria-label")).toBe(start);
    click(point(23)); click(point(21)); settle();
    expect(point(21).getAttribute("aria-label")).toContain("۱ مهره سفید");
    expect(centerUndo!.disabled).toBe(false);
    click(point(12)); click(point(9)); settle();
    expect(centerUndo!.disabled).toBe(true);
  });
  it("uses one die per destination, undoes exactly and commits the second move", () => {
    rolls=[3,2]; roll(); const start=point(23).getAttribute("aria-label");
    click(point(23)); click(point(20)); settle();
    expect(undoEnabled()).toBe(true);
    expect(container.querySelectorAll('[data-die-used-mark]')).toHaveLength(1);
    expect(point(20).getAttribute("aria-label")).toContain("۱ مهره سفید");
    click(undoButton()); expect(point(23).getAttribute("aria-label")).toBe(start);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    expect(undoEnabled()).toBe(false); expect(button("تاس بریز").disabled).toBe(false);
    expect(container.querySelector('[data-visible="true"][dir="rtl"]')?.textContent).toContain("تاس بریز");
  });
  it("blocks rapid repeated roll and move clicks during display", () => {
    rolls=[3,2,6,6]; const rollButton=button("تاس بریز");
    act(() => { rollButton.click(); rollButton.click(); rollButton.click(); }); settle();
    expect(rolls).toEqual([6,6]); click(point(23)); const dest=point(20);
    act(() => { dest.click(); dest.click(); dest.click(); }); settle();
    expect(undoEnabled()).toBe(true);
    expect(point(20).getAttribute("aria-label")).toContain("۱ مهره سفید");
  });
  it("renders four double markers and requires all four manual moves", () => {
    rolls=[3,2,3,3]; roll(); click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    click(button("تاس بریز")); settle();
    expect(container.querySelectorAll('[aria-label="تاس ۳"]')).toHaveLength(2);
    const sequence=[[0,3],[3,6],[6,9],[11,14]];
    for(let i=0;i<4;i++) {
      click(point(sequence[i][0])); click(point(sequence[i][1])); settle();
      if (i < 3) {
        const marks = [...container.querySelectorAll('[data-die-used-mark]')];
        expect(marks.reduce((total, mark) => total + Number(mark.getAttribute('data-used-count')), 0)).toBe(i + 1);
        expect(marks[0].textContent).toContain('۳');
      }
      expect(container.querySelector("footer")).toBeNull();
      expect(undoEnabled()).toBe(i!==3);
    }
    expect(button("تاس بریز").disabled).toBe(false);
  });
  it("exposes match selection, cube ownership and accepting/rejecting doubles", () => {
    act(() => root.render(React.createElement(BackgammonGame,{key:"match"})));
    start("5"); rolls=[3,2]; roll();
    click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    click(button("پیشنهاد دوبل ×۲")); expect(container.textContent).toContain("سفید؛ پیشنهاد دوبل ×۲");
    click(button("پذیرش دوبل")); expect(container.textContent).toContain("مالک: سفید");
    expect(button("پیشنهاد دوبل ×۴").disabled).toBe(true);
  });
  it("renders borne-off trays with live counts and a stacked checker area", () => {
    const trays = [...container.querySelectorAll('aside[aria-label="فضای خروج مهره‌ها"] > div')];
    expect(trays).toHaveLength(2);
    expect(trays.map(tray => tray.querySelector("strong")?.textContent?.trim())).toEqual(["0", "0"]);
    expect(trays.every(tray => tray.querySelector("[data-off-stack]"))).toBe(true);
    expect(trays.every(tray => tray.querySelector("[data-off-stack]")?.children.length === 0)).toBe(true);
    expect(trays.every(tray => tray.getAttribute("role") === "button")).toBe(true);
    expect(trays.every(tray => tray.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(trays.every(tray => tray.getAttribute("tabindex") === "-1")).toBe(true);
    expect(container.textContent).not.toContain("از ۱۵ مهره");
    expect(container.textContent).not.toContain("مهره سفید");
    expect(container.textContent).not.toContain("مهره سیاه");
  });
  it("renders refreshed player profile cards without hit or borne-off labels", () => {
    const cards = [...container.querySelectorAll('section[class*="playerStats"]')];
    expect(cards).toHaveLength(2);
    expect(container.querySelectorAll("[data-player-avatar]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-player-score]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-player-message]:disabled")).toHaveLength(0);
    expect(container.querySelectorAll("[data-player-checker]")).toHaveLength(2);
    expect(container.querySelectorAll(".chatPanel")).toHaveLength(0);
    expect(container.querySelectorAll(".chatToggle")).toHaveLength(0);
    expect(container.querySelectorAll("[data-player-country]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-player-timer]")).toHaveLength(2);
    expect(container.querySelectorAll("[data-player-match-score]")).toHaveLength(2);
    expect([...container.querySelectorAll("[data-player-match-score]")].map(node => node.textContent?.trim())).toEqual(["۰", "۰"]);
    expect(container.querySelectorAll("[data-player-level]")).toHaveLength(0);
    expect(container.textContent).not.toContain("Level");
    expect(container.textContent).not.toContain("زده‌شده:");
    expect(container.textContent).not.toContain("خارج‌شده:");
  });
  it("keeps the board on the simple theme without a theme picker", () => {
    const game = container.querySelector<HTMLElement>('[data-board-theme]');
    expect(game?.getAttribute("data-board-theme")).toBe("simple");
    expect(container.querySelector('[data-theme]')).toBeNull();

    click(button("باز کردن منوی بازی"));
    expect(container.querySelector('[data-board-theme="simple"]')).not.toBeNull();
    expect(container.querySelector('[data-theme]')).toBeNull();
    click(button("بستن منو"));

    expect(button("تاس بریز").disabled).toBe(false);
  });
});

describe("in-game chat", () => {
  it("opens the glass chat panel from a player message icon and sends a message", () => {
    const messageButton = container.querySelector<HTMLButtonElement>("[data-player-message]");
    expect(messageButton).not.toBeNull();
    click(messageButton!);
    expect(container.querySelector("[data-chat-panel]")).not.toBeNull();
    const input = container.querySelector<HTMLInputElement>('[aria-label="متن پیام"]')!;
    act(() => { const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set; setter?.call(input,"سلام دوست من"); input.dispatchEvent(new Event("input",{bubbles:true})); });
    click(button("ارسال پیام"));
    expect(container.textContent).toContain("سلام دوست من");
    expect(container.querySelector('[data-chat-toast][data-visible="true"]')?.textContent).toContain("سلام دوست من");
    act(() => vi.advanceTimersByTime(3000));
    expect(container.querySelector("[data-chat-toast]")?.getAttribute("data-visible")).toBe("false");
  });
});
