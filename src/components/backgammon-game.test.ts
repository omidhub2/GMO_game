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
function roll() { click(button("تاس شروع")); settle(); }
function status() { return container.querySelector('[role="status"]')!.textContent; }
function start(mode?: string) {
  if (mode) { click(button("ساده؛ بدون دوبل")); click(button(`مسابقه تا ${Number(mode).toLocaleString("fa-IR")} امتیاز`)); }
  click(button("انتخاب سفید")); click(button("تأیید انتخاب")); click(button("تأیید رنگ سیاه"));
}

beforeEach(() => {
  vi.useFakeTimers(); rolls=[5,2];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(crypto,"getRandomValues").mockImplementation((array) => { (array as Uint8Array)[0]=(rolls.shift() ?? 3)-1; return array; });
  container=document.createElement("div"); document.body.append(container); root=createRoot(container);
  act(() => root.render(React.createElement(BackgammonGame)));
  start();
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Persian manual board interactions", () => {
  it("waits after dice animation with zero selected checkers and no automatic move", () => {
    const before=[...container.querySelectorAll("[data-point]")].map(p=>p.getAttribute("aria-label"));
    click(button("تاس شروع")); expect(point(23).disabled).toBe(true);
    settle(); expect(status()).toBe("یک مهره انتخاب کن");
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect([...container.querySelectorAll("[data-point]")].map(p=>p.getAttribute("aria-label"))).toEqual(before);
    expect(button("تاس بریز").disabled).toBe(true);
  });
  it("shows every selected checker destination, supports cancellation and blocks invalid moves", () => {
    rolls=[3,2]; roll(); click(point(23));
    expect(point(20).getAttribute("aria-label")).toContain("مقصد مجاز با تاس ۳");
    expect(point(21).getAttribute("aria-label")).toContain("مقصد مجاز با تاس ۲");
    expect(container.querySelector('[aria-label="راهنمای حرکت"]')!.textContent).toContain("خانه ۲۱ • تاس ۳");
    click(point(0)); expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(button("برگشت").disabled).toBe(true);
    click(point(23)); click(point(23)); expect(point(23).getAttribute("aria-pressed")).toBe("false");
    click(point(23)); click(point(12)); expect(point(12).getAttribute("aria-pressed")).toBe("true");
  });
  it("uses one die per destination, undoes exactly and commits the second move", () => {
    rolls=[3,2]; roll(); const start=point(23).getAttribute("aria-label");
    click(point(23)); click(point(20)); settle();
    expect(button("برگشت").disabled).toBe(false);
    expect(container.querySelectorAll('[aria-label$="مصرف شده"]')).toHaveLength(1);
    click(button("برگشت")); expect(point(23).getAttribute("aria-label")).toBe(start);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    expect(button("برگشت").disabled).toBe(true); expect(button("تاس بریز").disabled).toBe(false);
    expect(status()).toContain("نوبت سیاه");
  });
  it("blocks rapid repeated roll and move clicks during display", () => {
    rolls=[3,2,6,6]; const rollButton=button("تاس شروع");
    act(() => { rollButton.click(); rollButton.click(); rollButton.click(); }); settle();
    expect(rolls).toEqual([6,6]); click(point(23)); const dest=point(20);
    act(() => { dest.click(); dest.click(); dest.click(); }); settle();
    expect(container.querySelectorAll('[aria-label$="مصرف شده"]')).toHaveLength(1);
    expect(point(20).getAttribute("aria-label")).toContain("۱ مهره سفید");
  });
  it("renders four double markers and requires all four manual moves", () => {
    rolls=[3,2,3,3]; roll(); click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    click(button("تاس بریز")); settle();
    expect(container.querySelectorAll('[aria-label="تاس ۳ باقی مانده"]')).toHaveLength(4);
    const sequence=[[0,3],[3,6],[6,9],[11,14]];
    for(let i=0;i<4;i++) {
      click(point(sequence[i][0])); click(point(sequence[i][1])); settle();
      expect(container.textContent).toContain(`جفت ۳ — ${["۱","۲","۳","۴"][i]} حرکت از چهار حرکت مصرف شده`);
      expect(button("برگشت").disabled).toBe(i===3);
    }
    expect(status()).toContain("نوبت سفید");
  });
  it("exposes match selection, cube ownership and accepting/rejecting doubles", () => {
    act(() => root.render(React.createElement(BackgammonGame,{key:"match"})));
    start("5"); rolls=[3,2]; roll();
    click(point(23)); click(point(20)); settle(); click(point(12)); click(point(10)); settle();
    click(button("پیشنهاد دوبل ×۲")); expect(container.textContent).toContain("سفید؛ پیشنهاد دوبل ×۲");
    click(button("پذیرش دوبل")); expect(container.textContent).toContain("مالک: سفید");
    expect(button("پیشنهاد دوبل ×۴").disabled).toBe(true);
  });
});
