import { describe, expect, it } from "vitest";
import { getDemoGame, listDemoGames, toGameSummary } from "./game";

describe("game catalog", () => {
  it("maps database games to safe public summaries", () => {
    expect(toGameSummary({ id: "game-1", slug: "valorant", name: "VALORANT", category: "FPS", platforms: ["PC"], integrationType: "MANUAL", _count: { tournaments: 3 } })).toEqual({ id: "game-1", slug: "valorant", name: "VALORANT", category: "FPS", platforms: ["PC"], integrationStatus: "MANUAL", activeTournamentCount: 3, demo: false });
    expect(toGameSummary({ id: "game-2", slug: "unknown", name: "Unknown", category: "Other", platforms: [], integrationType: "UNSUPPORTED", _count: { tournaments: 0 } }).integrationStatus).toBe("UNSUPPORTED");
  });

  it("filters demo games by game and platform names", () => {
    expect(listDemoGames("valorant")).toHaveLength(1);
    expect(listDemoGames("Android")[0]?.slug).toBe("pubg-mobile");
    expect(listDemoGames("not a game")).toHaveLength(0);
  });
  it("marks all seeded catalog content as demo and does not return mutable platforms", () => {
    const game = getDemoGame("valorant");
    expect(game?.demo).toBe(true);
    expect(game?.integrationStatus).toBe("MANUAL");
    expect(game?.platforms).toEqual(["PC"]);
  });
});
