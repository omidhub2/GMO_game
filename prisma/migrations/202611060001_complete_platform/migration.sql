-- Complete the initial GMO ARENA schema for auth, teams, payments, rewards and operations.
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED', 'EXPIRED');
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED');
CREATE TYPE "TeamMemberRole" AS ENUM ('OWNER', 'CAPTAIN', 'MEMBER');

ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(32);
ALTER TABLE "missions" ADD COLUMN "slug" VARCHAR(120);
UPDATE "missions" SET "slug" = 'legacy-mission-' || "id"::text WHERE "slug" IS NULL;
ALTER TABLE "missions" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "missions_slug_key" ON "missions"("slug");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
ALTER TABLE "external_accounts" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE "tournaments" ADD COLUMN "created_by_id" UUID;
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "tournaments_created_by_id_created_at_idx" ON "tournaments"("created_by_id", "created_at");

ALTER TABLE "tournament_participants" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "tournament_participants" ADD COLUMN "team_id" UUID;
ALTER TABLE "tournament_participants" DROP CONSTRAINT "tournament_participants_user_id_fkey";
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "tournament_participants_tournament_id_team_id_key" ON "tournament_participants"("tournament_id", "team_id");
CREATE INDEX "tournament_participants_user_id_registered_at_idx" ON "tournament_participants"("user_id", "registered_at");
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_exactly_one_competitor" CHECK (("user_id" IS NOT NULL) <> ("team_id" IS NOT NULL));

-- The initial migration already creates tournament_matches_tournament_id_fkey.
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_participant_a_fkey" FOREIGN KEY ("participant_a") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_participant_b_fkey" FOREIGN KEY ("participant_b") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "tournament_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The initial migration already creates ranking and rating-history foreign keys/checks.
ALTER TABLE "rating_history" DROP CONSTRAINT "rating_history_match_reference_key";
CREATE UNIQUE INDEX "rating_history_match_reference_user_id_key" ON "rating_history"("match_reference", "user_id");
CREATE INDEX "rating_history_game_id_created_at_idx" ON "rating_history"("game_id", "created_at");

-- The initial migration already creates referral checks/foreign keys and notification foreign key.
CREATE UNIQUE INDEX "referrals_inviter_id_referral_code_key" ON "referrals"("inviter_id", "referral_code");

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL, "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "last_seen_at" TIMESTAMPTZ(6),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

CREATE TABLE "teams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(80) NOT NULL, "slug" VARCHAR(100) NOT NULL,
  "logo_url" VARCHAR(2048), "description" VARCHAR(500) NOT NULL DEFAULT '', "owner_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");
CREATE INDEX "teams_owner_id_created_at_idx" ON "teams"("owner_id", "created_at");
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "team_members" (
  "team_id" UUID NOT NULL, "user_id" UUID NOT NULL, "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id", "user_id"),
  CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "team_members_user_id_joined_at_idx" ON "team_members"("user_id", "joined_at");
INSERT INTO "team_members" ("team_id", "user_id", "role") SELECT "id", "owner_id", 'OWNER' FROM "teams";

CREATE TABLE "wallet_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "account_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "tournament_id" UUID NOT NULL, "amount" BIGINT NOT NULL, "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "idempotency_key" VARCHAR(128) NOT NULL, "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_reservations_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "wallet_reservations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wallet_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wallet_reservations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "wallet_reservations_idempotency_key" ON "wallet_reservations"("idempotency_key");
CREATE INDEX "wallet_reservations_account_id_status_idx" ON "wallet_reservations"("account_id", "status");
CREATE INDEX "wallet_reservations_tournament_id_status_idx" ON "wallet_reservations"("tournament_id", "status");

CREATE TABLE "deposits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "transaction_id" UUID,
  "amount" BIGINT NOT NULL, "currency" VARCHAR(8) NOT NULL DEFAULT 'GMO', "provider" VARCHAR(40) NOT NULL,
  "external_reference" VARCHAR(160), "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "verified_at" TIMESTAMPTZ(6),
  CONSTRAINT "deposits_pkey" PRIMARY KEY ("id"), CONSTRAINT "deposits_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "deposits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "deposits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "deposits_transaction_id_key" ON "deposits"("transaction_id");
CREATE UNIQUE INDEX "deposits_provider_external_reference_key" ON "deposits"("provider", "external_reference");
CREATE INDEX "deposits_user_id_created_at_idx" ON "deposits"("user_id", "created_at");
CREATE INDEX "deposits_status_created_at_idx" ON "deposits"("status", "created_at");

CREATE TABLE "withdrawals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "transaction_id" UUID,
  "amount" BIGINT NOT NULL, "currency" VARCHAR(8) NOT NULL DEFAULT 'GMO', "provider" VARCHAR(40) NOT NULL,
  "external_reference" VARCHAR(160), "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processed_at" TIMESTAMPTZ(6),
  CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id"), CONSTRAINT "withdrawals_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "withdrawals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "withdrawals_transaction_id_key" ON "withdrawals"("transaction_id");
CREATE UNIQUE INDEX "withdrawals_provider_external_reference_key" ON "withdrawals"("provider", "external_reference");
CREATE INDEX "withdrawals_user_id_created_at_idx" ON "withdrawals"("user_id", "created_at");
CREATE INDEX "withdrawals_status_created_at_idx" ON "withdrawals"("status", "created_at");

CREATE TABLE "rewards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "transaction_id" UUID,
  "reward_type" VARCHAR(40) NOT NULL, "amount" BIGINT NOT NULL, "source" VARCHAR(80) NOT NULL,
  "reference" VARCHAR(128) NOT NULL, "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rewards_pkey" PRIMARY KEY ("id"), CONSTRAINT "rewards_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rewards_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rewards_transaction_id_key" ON "rewards"("transaction_id");
CREATE UNIQUE INDEX "rewards_reference_key" ON "rewards"("reference");
CREATE INDEX "rewards_user_id_created_at_idx" ON "rewards"("user_id", "created_at");
CREATE INDEX "rewards_status_created_at_idx" ON "rewards"("status", "created_at");

CREATE TABLE "achievements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "slug" VARCHAR(120) NOT NULL, "title" VARCHAR(140) NOT NULL,
  "description" VARCHAR(500) NOT NULL, "icon" VARCHAR(120), "requirements" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "achievements_slug_key" ON "achievements"("slug");
CREATE INDEX "achievements_is_active_created_at_idx" ON "achievements"("is_active", "created_at");

CREATE TABLE "user_achievements" (
  "user_id" UUID NOT NULL, "achievement_id" UUID NOT NULL, "unlocked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("user_id", "achievement_id"),
  CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_achievements_achievement_id_unlocked_at_idx" ON "user_achievements"("achievement_id", "unlocked_at");

CREATE TABLE "admin_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" VARCHAR(64) NOT NULL, "permissions" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");
CREATE TABLE "admin_users" (
  "user_id" UUID NOT NULL, "role_id" UUID NOT NULL, "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admin_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "admin_users_role_id_granted_at_idx" ON "admin_users"("role_id", "granted_at");

CREATE TABLE "system_settings" (
  "key" VARCHAR(120) NOT NULL, "value" JSONB NOT NULL, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "infrastructure_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "service" VARCHAR(80) NOT NULL, "metric" VARCHAR(100) NOT NULL,
  "value" DECIMAL(24,8) NOT NULL, "unit" VARCHAR(32), "measured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "infrastructure_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "infrastructure_usage_service_metric_measured_at_idx" ON "infrastructure_usage"("service", "metric", "measured_at");

-- Enforce double-entry balance and prohibit empty or one-sided ledger transactions at commit time.
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id UUID; entry_count BIGINT; debit_total NUMERIC; credit_total NUMERIC;
BEGIN
  target_id := CASE WHEN TG_TABLE_NAME = 'ledger_transactions' THEN NEW.id ELSE NEW.transaction_id END;
  SELECT COUNT(*), COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
         COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0)
    INTO entry_count, debit_total, credit_total FROM ledger_entries WHERE transaction_id = target_id;
  IF entry_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Ledger transaction % must contain at least two balanced entries', target_id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER ledger_transaction_balanced_after_create
  AFTER INSERT ON ledger_transactions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
CREATE CONSTRAINT TRIGGER ledger_entries_balanced_after_insert
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();
CREATE INDEX "wallet_accounts_account_type_currency_is_active_idx" ON "wallet_accounts"("account_type", "currency", "is_active");
