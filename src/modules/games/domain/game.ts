export type GameIntegrationStatus = "MANUAL" | "AVAILABLE" | "UNSUPPORTED";
export interface GameSummary { id: string; slug: string; name: string; category: string; platforms: readonly string[]; activeTournamentCount: number; integrationStatus: GameIntegrationStatus; demo: boolean }
export interface GameRecord { id: string; slug: string; name: string; category: string; platforms: string[]; integrationType: string; _count: { tournaments: number } }

export function toGameSummary(game: GameRecord): GameSummary {
  const integrationStatus: GameIntegrationStatus = game.integrationType === "UNSUPPORTED" ? "UNSUPPORTED" : game.integrationType === "MANUAL" ? "MANUAL" : "AVAILABLE";
  return { id: game.id, slug: game.slug, name: game.name, category: game.category, platforms: [...game.platforms], activeTournamentCount: game._count.tournaments, integrationStatus, demo: false };
}

const games: readonly GameSummary[] = [
  { id: "demo-backgammon", slug: "backgammon", name: "BACKGAMMON", category: "Board game", platforms: ["Web", "Telegram"], activeTournamentCount: 0, integrationStatus: "MANUAL", demo: true },
  { id: "demo-valorant", slug: "valorant", name: "VALORANT", category: "تیراندازی رقابتی", platforms: ["PC"], activeTournamentCount: 2, integrationStatus: "MANUAL", demo: true },
  { id: "demo-fc25", slug: "fc-25", name: "EA SPORTS FC 25", category: "ورزشی", platforms: ["PlayStation", "Xbox", "PC"], activeTournamentCount: 1, integrationStatus: "MANUAL", demo: true },
  { id: "demo-pubg-mobile", slug: "pubg-mobile", name: "PUBG MOBILE", category: "بتل رویال", platforms: ["iOS", "Android"], activeTournamentCount: 0, integrationStatus: "MANUAL", demo: true },
];
/** Demo-only catalog. Production routes must use a database-backed repository. */
export function listDemoGames(query = ""): GameSummary[] {
  const normalized = query.trim().toLocaleLowerCase("fa");
  return games.filter((game) => !normalized || `${game.name} ${game.category} ${game.platforms.join(" ")}`.toLocaleLowerCase("fa").includes(normalized)).map((game) => ({ ...game, platforms: [...game.platforms] }));
}
export function getDemoGame(slug: string): GameSummary | undefined { const game = games.find((candidate) => candidate.slug === slug); return game ? { ...game, platforms: [...game.platforms] } : undefined; }
