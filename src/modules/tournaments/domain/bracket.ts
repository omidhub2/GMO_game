export interface BracketParticipant {
  id: string;
  seed?: number;
}

export interface BracketMatch<T extends BracketParticipant = BracketParticipant> {
  round: number;
  matchNumber: number;
  participantA: T | null;
  participantB: T | null;
  bye: boolean;
}

export interface SingleEliminationBracket<T extends BracketParticipant> {
  matches: BracketMatch<T>[];
  roundCount: number;
  bracketSize: number;
}

/** Build a seeded single-elimination bracket, including first-round byes for non-power-of-two fields. */
export function createSingleEliminationBracket<T extends BracketParticipant>(input: readonly T[]): SingleEliminationBracket<T> {
  if (input.length < 2) throw new Error("At least two participants are required.");
  const ids = new Set(input.map(({ id }) => id));
  if (ids.size !== input.length || input.some(({ id }) => !id.trim())) throw new Error("Participant IDs must be non-empty and unique.");

  const participants = [...input].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const roundOneMatchCount = bracketSize / 2;
  const byeCount = bracketSize - participants.length;
  const matches: BracketMatch<T>[] = [];

  // Standard tournament bye placement: the top seeds advance, then remaining seeds pair in order.
  const firstRoundSlots: (T | null)[] = [...participants.slice(0, byeCount), ...participants.slice(byeCount)];
  const seededSlots: (T | null)[] = [];
  let participantIndex = 0;
  for (let matchIndex = 0; matchIndex < roundOneMatchCount; matchIndex += 1) {
    if (matchIndex < byeCount) {
      seededSlots.push(firstRoundSlots[participantIndex++] ?? null, null);
    } else {
      seededSlots.push(firstRoundSlots[participantIndex++] ?? null, firstRoundSlots[participantIndex++] ?? null);
    }
  }
  for (let index = 0; index < roundOneMatchCount; index += 1) {
    const participantA = seededSlots[index * 2] ?? null;
    const participantB = seededSlots[index * 2 + 1] ?? null;
    matches.push({ round: 1, matchNumber: index + 1, participantA, participantB, bye: Boolean(participantA) !== Boolean(participantB) });
  }

  let currentRoundMatches = bracketSize / 2;
  let round = 2;
  let matchNumber = 1;
  while (currentRoundMatches > 1) {
    currentRoundMatches /= 2;
    for (let index = 0; index < currentRoundMatches; index += 1) {
      matches.push({ round, matchNumber, participantA: null, participantB: null, bye: false });
      matchNumber += 1;
    }
    round += 1;
    matchNumber = 1;
  }

  return { matches, roundCount: Math.log2(bracketSize), bracketSize };
}
