export interface EloResult {
  expectedA: number;
  expectedB: number;
  ratingA: number;
  ratingB: number;
  deltaA: number;
  deltaB: number;
}

export interface EloOptions {
  kFactor?: number;
  scoreA?: 0 | 0.5 | 1;
}

/** Pure Elo calculation; invoke on the server only and persist once per verified match. */
export function calculateElo(ratingA: number, ratingB: number, options: EloOptions = {}): EloResult {
  const kFactor = options.kFactor ?? 32;
  const scoreA = options.scoreA ?? 1;
  if (!Number.isFinite(ratingA) || ratingA < 0 || !Number.isFinite(ratingB) || ratingB < 0) throw new Error("Ratings must be finite non-negative numbers.");
  if (!Number.isFinite(kFactor) || kFactor <= 0) throw new Error("K-factor must be a positive finite number.");
  if (scoreA !== 0 && scoreA !== 0.5 && scoreA !== 1) throw new Error("Score must be 0, 0.5, or 1.");

  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const deltaA = Math.round(kFactor * (scoreA - expectedA));
  const deltaB = -deltaA;
  return { expectedA, expectedB, ratingA: ratingA + deltaA, ratingB: ratingB + deltaB, deltaA, deltaB };
}
