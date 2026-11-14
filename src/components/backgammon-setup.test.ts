// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import BackgammonGame from "./backgammon-game";

vi.mock("next/link",()=>({default:({children,...props}:React.ComponentProps<"a">)=>React.createElement("a",props,children)}));
let root:Root, container:HTMLDivElement;
function button(text:string) { const el=[...container.querySelectorAll("button")].find(b=>b.textContent?.trim()===text || b.getAttribute("aria-label")===text);expect(el,text).toBeDefined();return el!; }
function click(text:string) { act(()=>button(text).click()); }
function start() { click("انتخاب سفید");click("انتخاب سیاه");click("ورود به بازی"); }
function diceButton() { const el=container.querySelector<HTMLButtonElement>("[data-dice-box]");expect(el).toBeDefined();return el!; }
function pointer(type:string,id=1) { act(()=>{ const event=new MouseEvent(type,{bubbles:true,button:0});Object.defineProperty(event,"pointerId",{value:id});diceButton().dispatchEvent(event); }); }
function advance(ms:number) {act(()=>vi.advanceTimersByTime(ms));}
beforeEach(()=>{
  vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  let values=[2,1];vi.spyOn(crypto,"getRandomValues").mockImplementation(array=>{(array as Uint8Array)[0]=values.shift()??2;return array;});
  Object.defineProperty(HTMLElement.prototype,"requestFullscreen",{configurable:true,value:vi.fn().mockResolvedValue(undefined)});
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(this:HTMLDialogElement){this.open=false;}});
  container=document.createElement("div");document.body.append(container);root=createRoot(container);act(()=>root.render(React.createElement(BackgammonGame)));
});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.restoreAllMocks();vi.useRealTimers();});

describe("pregame, full-screen table and press/release dice",()=>{
  it("shows settings before play; reserves opposite color and waits for both players",()=>{
    expect(container.querySelectorAll("[data-point]")).toHaveLength(0);
    const choices = container.querySelectorAll('[aria-label="انتخاب رنگ مهره‌ها"] button');
    click("انتخاب سیاه");expect(container.querySelector('[role="status"]')!.textContent).toContain("منتظر تأیید مهرهٔ سفید");
    expect(container.querySelector('[aria-pressed="true"]')).toBe(choices[1]);
    click("انتخاب سفید");expect(container.querySelectorAll("[data-point]")).toHaveLength(0);
    click("لغو تأیید مهرهٔ سیاه");expect(button("پس از تأیید هر دو، ورود به بازی").disabled).toBe(true);
    expect(container.querySelectorAll('[aria-label="انتخاب رنگ مهره‌ها"] button')[1]).toBe(choices[1]);
    click("انتخاب سیاه");click("ورود به بازی");expect(container.querySelectorAll("[data-point]")).toHaveLength(24);expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector('[aria-label="شمارش مهره‌ها در سمت راست"]')!.querySelectorAll("[data-bar]")).toHaveLength(2);
  });
  it("does not exchange colors until opponent accepts; resets both ready confirmations",()=>{
    click("انتخاب سفید");click("انتخاب سیاه");click("درخواست جابه‌جایی مهره‌ها");
    expect(button("لغو تأیید مهرهٔ سفید").textContent).toContain("انتخاب شما: سفید");
    expect(button("لغو تأیید مهرهٔ سفید").disabled).toBe(true);
    expect(button("پس از تأیید هر دو، ورود به بازی").disabled).toBe(true);
    click("پذیرش توسط نفر دوم");expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);expect(container.querySelectorAll("[data-point]")).toHaveLength(0);
    click("انتخاب سیاه");expect(button("لغو تأیید مهرهٔ سیاه").textContent).toContain("انتخاب شما: سیاه");
    click("انتخاب سفید");click("ورود به بازی");expect(container.querySelectorAll("[data-point]")).toHaveLength(24);
  });
  it("spins for an indefinite hold; reveals first at 500ms and second 400ms later without automatic movement",()=>{
    start();pointer("pointerdown");advance(10000);
    expect(container.querySelector("[data-dice-box]")!.getAttribute("data-stage")).toBe("holding");expect(crypto.getRandomValues).not.toHaveBeenCalled();
    pointer("pointerup");expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);advance(499);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(0);
    advance(1);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(1);expect(container.querySelector('[data-revealed="true"]')!.getAttribute("aria-label")).toBe("تاس ۳");
    advance(399);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(1);advance(1);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(2);
    expect(container.querySelector('[data-dice-box]')!.getAttribute("aria-label")).toBe("تاس بریز");expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });
  it("blocks repeated release/clicks and secondary pointers while dice are resolving",()=>{
    start();pointer("pointerdown");pointer("pointerdown",2);pointer("pointerup",2);expect(crypto.getRandomValues).not.toHaveBeenCalled();pointer("pointerup");pointer("pointerup");click("تاس بریز");advance(900);expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
  });
  it("cancels pointer interruptions without rolling or locking the board",()=>{
    start();pointer("pointerdown");pointer("pointercancel");expect(crypto.getRandomValues).not.toHaveBeenCalled();expect(container.querySelector("[data-dice-box]")!.getAttribute("data-stage")).toBe("idle");
    act(()=>diceButton().click());advance(900);expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
  });
  it("supports keyboard hold/release with the same reveal timing",()=>{
    start();const el=diceButton();act(()=>el.dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true})));advance(2000);expect(crypto.getRandomValues).not.toHaveBeenCalled();
    act(()=>el.dispatchEvent(new KeyboardEvent("keyup",{key:" ",bubbles:true})));advance(500);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(1);advance(400);expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(2);
  });
  it("opens the left menu as a modal, focuses close, and returns to pregame settings",()=>{
    start();click("باز کردن منوی بازی");const dialog=container.querySelector("dialog")!;expect(dialog.open).toBe(true);expect(document.activeElement).toBe(button("بستن منو"));
    const newGame=[...container.querySelectorAll("button")].find(b=>b.textContent?.includes("بازی جدید و تنظیمات"))!;act(()=>newGame.click());
    expect(container.querySelector("dialog")).toBeNull();expect(container.querySelector("[aria-label='آماده‌سازی بازی']")).not.toBeNull();expect(container.querySelectorAll("[data-point]")).toHaveLength(0);
  });
  it("cleans up staged reveal timers when the screen unmounts",()=>{
    start();pointer("pointerdown");pointer("pointerup");expect(vi.getTimerCount()).toBeGreaterThanOrEqual(2);act(()=>root.unmount());expect(vi.getTimerCount()).toBe(0);
    root=createRoot(container);act(()=>root.render(React.createElement(BackgammonGame)));
  });
});
