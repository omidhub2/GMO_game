import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
const menuPath = path.resolve(process.cwd(), "src/components/game-menu.tsx");

describe("GMO ARENA home menu", () => {
  it("routes the homepage to the current game menu component", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('@/components/game-menu');
  });

  it("exposes the four current player hub modes", async () => {
    const source = await readFile(menuPath, "utf8");
    for (const label of ['label: "PLAY"', 'label: "COMPETE"', 'label: "PREDICT"', 'label: "WALLET"']) {
      expect(source).toContain(label);
    }
  });

  it("clearly marks the fallback wallet as demonstrative", async () => {
    const source = await readFile(menuPath, "utf8");
    expect(source).toContain("demo: true");
    expect(source).toContain("Demo wallet. These tokens are for preview only.");
  });
});
