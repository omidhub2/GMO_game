-- GMO ARENA initial PostgreSQL schema. Keep all financial amounts in integer GMO units.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'LEAGUE', 'POINTS_BASED');
CREATE TYPE "ParticipantStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'WITHDRAWN', 'DISQUALIFIED');
CREATE TYPE "WalletAccountType" AS ENUM ('BALANCE', 'REWARDS', 'PRIZE', 'SYSTEM');
CREATE TYPE "LedgerTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'TOURNAMENT_ENTRY', 'TOURNAMENT_REFUND', 'PRIZE', 'MISSION_REWARD', 'REFERRAL_REWARD', 'REVERSAL', 'ADJUSTMENT');
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED', 'FAILED');
CREATE TYPE "EntryDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "MissionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "UserMissionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED', 'EXPIRED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "username" VARCHAR(32) NOT NULL,
  "email" VARCHAR(320),
  "password_hash" VARCHAR(255),
  "avatar_url" VARCHAR(2048),
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

CREATE TABLE "user_profiles" (
  "user_id" UUID NOT NULL,
  "display_name" VARCHAR(64), "bio" VARCHAR(500), "country" CHAR(2),
  "preferred_locale" VARCHAR(8) NOT NULL DEFAULT 'fa', "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "player_level" INTEGER NOT NULL DEFAULT 1, "experience" INTEGER NOT NULL DEFAULT 0,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "external_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL,
  "provider" VARCHAR(32) NOT NULL, "provider_user_id" VARCHAR(128) NOT NULL,
  "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "external_accounts_provider_user_id_key" ON "external_accounts"("provider", "provider_user_id");
CREATE INDEX "external_accounts_user_id_provider_idx" ON "external_accounts"("user_id", "provider");

CREATE TABLE "games" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(100) NOT NULL, "slug" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL, "artwork_url" VARCHAR(2048), "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category" VARCHAR(50) NOT NULL, "integration_type" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  "is_enabled" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");
CREATE INDEX "games_is_enabled_category_idx" ON "games"("is_enabled", "category");

CREATE TABLE "game_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "game_id" UUID NOT NULL,
  "external_player_id" VARCHAR(128), "username" VARCHAR(64) NOT NULL, "verified_at" TIMESTAMPTZ(6),
  CONSTRAINT "game_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "game_accounts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "game_accounts_user_id_game_id_key" ON "game_accounts"("user_id", "game_id");

CREATE TABLE "tournaments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "game_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL, "slug" VARCHAR(180) NOT NULL, "description" TEXT NOT NULL,
  "format" "TournamentFormat" NOT NULL, "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
  "registration_starts_at" TIMESTAMPTZ(6) NOT NULL, "registration_ends_at" TIMESTAMPTZ(6) NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL, "ends_at" TIMESTAMPTZ(6),
  "max_participants" INTEGER NOT NULL, "entry_fee" BIGINT NOT NULL DEFAULT 0, "prize_pool" BIGINT NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'GMO', "rules" TEXT NOT NULL DEFAULT '',
  "demo_content" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournaments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tournaments_positive_capacity" CHECK ("max_participants" > 1),
  CONSTRAINT "tournaments_nonnegative_amounts" CHECK ("entry_fee" >= 0 AND "prize_pool" >= 0),
  CONSTRAINT "tournaments_registration_window" CHECK ("registration_starts_at" < "registration_ends_at" AND "registration_ends_at" <= "starts_at")
);
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");
CREATE INDEX "tournaments_status_starts_at_idx" ON "tournaments"("status", "starts_at");
CREATE INDEX "tournaments_game_id_status_idx" ON "tournaments"("game_id", "status");

CREATE TABLE "tournament_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tournament_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "status" "ParticipantStatus" NOT NULL DEFAULT 'REGISTERED', "seed" INTEGER, "final_position" INTEGER,
  "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tournament_participants_tournament_id_user_id_key" ON "tournament_participants"("tournament_id", "user_id");
CREATE INDEX "tournament_participants_tournament_id_status_idx" ON "tournament_participants"("tournament_id", "status");

CREATE TABLE "wallet_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID, "account_type" "WalletAccountType" NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'GMO', "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wallet_accounts_system_or_user_type" CHECK (("account_type" = 'SYSTEM' AND "user_id" IS NULL) OR ("account_type" <> 'SYSTEM' AND "user_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "wallet_accounts_user_id_account_type_currency_key" ON "wallet_accounts"("user_id", "account_type", "currency");
CREATE INDEX "wallet_accounts_user_id_is_active_idx" ON "wallet_accounts"("user_id", "is_active");

CREATE TABLE "ledger_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "reference" VARCHAR(100) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL, "type" "LedgerTransactionType" NOT NULL,
  "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'COMPLETED', "description" VARCHAR(500) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB, "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ledger_transactions_reference_key" ON "ledger_transactions"("reference");
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key" ON "ledger_transactions"("idempotency_key");
CREATE INDEX "ledger_transactions_created_at_type_idx" ON "ledger_transactions"("created_at", "type");
CREATE INDEX "ledger_transactions_actor_id_created_at_idx" ON "ledger_transactions"("actor_id", "created_at");

CREATE TABLE "ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "transaction_id" UUID NOT NULL, "account_id" UUID NOT NULL,
  "amount" BIGINT NOT NULL, "direction" "EntryDirection" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_positive_amount" CHECK ("amount" > 0)
);
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial ledger records are immutable; create a reversal transaction instead';
END;
$$;
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON "ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER ledger_transactions_immutable BEFORE UPDATE OR DELETE ON "ledger_transactions" FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE TABLE "missions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "title" VARCHAR(140) NOT NULL, "description" VARCHAR(500) NOT NULL,
  "mission_type" VARCHAR(40) NOT NULL, "reward" BIGINT NOT NULL DEFAULT 0,
  "requirements" JSONB NOT NULL DEFAULT '{}'::JSONB, "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6), "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "missions_pkey" PRIMARY KEY ("id"), CONSTRAINT "missions_nonnegative_reward" CHECK ("reward" >= 0)
);
CREATE INDEX "missions_status_starts_at_ends_at_idx" ON "missions"("status", "starts_at", "ends_at");

CREATE TABLE "user_missions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "mission_id" UUID NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0, "status" "UserMissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "completed_at" TIMESTAMPTZ(6), "claimed_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_missions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_missions_nonnegative_progress" CHECK ("progress" >= 0)
);
CREATE UNIQUE INDEX "user_missions_user_id_mission_id_key" ON "user_missions"("user_id", "mission_id");
CREATE INDEX "user_missions_user_id_status_idx" ON "user_missions"("user_id", "status");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actor_id" UUID, "action" VARCHAR(100) NOT NULL,
  "resource_type" VARCHAR(64) NOT NULL, "resource_id" VARCHAR(128), "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

CREATE TABLE "tournament_matches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tournament_id" UUID NOT NULL,
  "round" INTEGER NOT NULL, "match_number" INTEGER NOT NULL, "participant_a" UUID, "participant_b" UUID,
  "score_a" INTEGER, "score_b" INTEGER, "winner_id" UUID, "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "scheduled_at" TIMESTAMPTZ(6), "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_matches_valid_round" CHECK ("round" > 0 AND "match_number" > 0),
  CONSTRAINT "tournament_matches_valid_score" CHECK (("score_a" IS NULL OR "score_a" >= 0) AND ("score_b" IS NULL OR "score_b" >= 0))
);
CREATE UNIQUE INDEX "tournament_matches_tournament_round_number_key" ON "tournament_matches"("tournament_id", "round", "match_number");
CREATE INDEX "tournament_matches_tournament_id_status_idx" ON "tournament_matches"("tournament_id", "status");

CREATE TABLE "rankings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "game_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 1000, "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0, "matches_played" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "rankings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rankings_nonnegative_stats" CHECK ("wins" >= 0 AND "losses" >= 0 AND "draws" >= 0 AND "matches_played" >= 0),
  CONSTRAINT "rankings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rankings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rankings_user_id_game_id_key" ON "rankings"("user_id", "game_id");
CREATE INDEX "rankings_game_id_rating_idx" ON "rankings"("game_id", "rating" DESC);

CREATE TABLE "rating_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "match_reference" VARCHAR(128) NOT NULL,
  "user_id" UUID NOT NULL, "game_id" UUID NOT NULL, "previous_rating" INTEGER NOT NULL,
  "new_rating" INTEGER NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rating_history_match_reference_key" UNIQUE ("match_reference"),
  CONSTRAINT "rating_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rating_history_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "rating_history_user_id_created_at_idx" ON "rating_history"("user_id", "created_at");

CREATE TABLE "referrals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "inviter_id" UUID NOT NULL, "invited_user_id" UUID NOT NULL,
  "referral_code" VARCHAR(32) NOT NULL, "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "reward_status" VARCHAR(24) NOT NULL DEFAULT 'LOCKED', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "referrals_not_self" CHECK ("inviter_id" <> "invited_user_id"),
  CONSTRAINT "referrals_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "referrals_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "referrals_invited_user_id_key" ON "referrals"("invited_user_id");
CREATE INDEX "referrals_inviter_id_created_at_idx" ON "referrals"("inviter_id", "created_at");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL, "message" VARCHAR(1000) NOT NULL,
  "type" VARCHAR(32) NOT NULL, "read_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
