import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "../src/app/page";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children) }));

describe("GMO Arena homepage", () => {
  it("renders the current lobby and its four game modes", () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));
    for (const label of ["PLAY", "COMPETE", "PREDICT", "WALLET"]) expect(html).toContain(label);
    expect(html).toContain('aria-label="Choose your game mode"');
    expect(html).toContain('href="/games"');
    expect(html).toContain('aria-label="Change avatar"');
  });
  it("marks the initial preview wallet as a demo", () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));
    expect(html).toContain("Demo");
    expect(html).toContain('aria-label="Open wallet"');
  });
  it("marks unreleased predictions and offers invitations", () => {
    const html = renderToStaticMarkup(React.createElement(HomePage));
    expect(html).toContain("Coming soon");
    expect(html).toContain("INVITE YOUR SQUAD");
  });
});
