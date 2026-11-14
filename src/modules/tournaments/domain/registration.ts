export type RegistrationStatus = "DRAFT" | "PUBLISHED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DISPUTED";
export interface RegistrationTournament { status: RegistrationStatus; registrationStartsAt: Date; registrationEndsAt: Date; startsAt: Date; maxParticipants: number; entryFee: bigint; demoContent: boolean }
export interface RegistrationCommand { tournamentId: string; userId: string; idempotencyKey: string; now?: Date }
export interface RegistrationDependencies {
  findTournamentForUpdate(id: string): Promise<RegistrationTournament | null>;
  countActiveParticipants(tournamentId: string): Promise<number>;
  findParticipant(tournamentId: string, userId: string): Promise<{ id: string; status: string } | null>;
  registerParticipant(tournamentId: string, userId: string): Promise<{ id: string; status: string }>;
  /** Adapter must atomically debit user accounts, credit a system account, and honor idempotency. */
  chargeEntryFee(input: { tournamentId: string; userId: string; amount: bigint; idempotencyKey: string }): Promise<void>;
}
export interface RegistrationTransactionClient { $transaction<T>(operation: (transaction: RegistrationDependencies) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T> }
export class RegistrationError extends Error { constructor(message: string) { super(message); this.name = "RegistrationError"; } }

/** Adapter-backed transactional registration. Fee collection is never emulated or skipped. */
export async function registerForTournament(client: RegistrationTransactionClient, dependencies: RegistrationDependencies, command: RegistrationCommand): Promise<{ participantId: string; status: string }> {
  if (!command.tournamentId || !command.userId || !command.idempotencyKey) throw new RegistrationError("Invalid registration identifiers.");
  const now = command.now ?? new Date();
  try {
    return await client.$transaction(async (tx) => {
      const tournament = await tx.findTournamentForUpdate(command.tournamentId);
      if (!tournament) throw new RegistrationError("Tournament was not found.");
      if (tournament.demoContent) throw new RegistrationError("Demo tournaments cannot accept registrations.");
      if (tournament.status !== "REGISTRATION_OPEN") throw new RegistrationError("Tournament registration is not open.");
      if (now < tournament.registrationStartsAt || now >= tournament.registrationEndsAt || now >= tournament.startsAt) throw new RegistrationError("Registration is outside the allowed time window.");
      if (tournament.maxParticipants < 2 || tournament.entryFee < 0n) throw new RegistrationError("Tournament configuration is invalid.");
      const existing = await tx.findParticipant(command.tournamentId, command.userId);
      if (existing && existing.status !== "WITHDRAWN") throw new RegistrationError("User is already registered for this tournament.");
      if (await tx.countActiveParticipants(command.tournamentId) >= tournament.maxParticipants) throw new RegistrationError("Tournament is full.");
      if (tournament.entryFee > 0n) await tx.chargeEntryFee({ tournamentId: command.tournamentId, userId: command.userId, amount: tournament.entryFee, idempotencyKey: command.idempotencyKey });
      const participant = await tx.registerParticipant(command.tournamentId, command.userId);
      return { participantId: participant.id, status: participant.status };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof RegistrationError) throw error;
    if (isUniqueConstraintError(error)) throw new RegistrationError("User is already registered for this tournament.");
    throw error;
  }
}
function isUniqueConstraintError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
