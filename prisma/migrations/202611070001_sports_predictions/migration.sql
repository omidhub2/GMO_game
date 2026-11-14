-- Generic sporting events, fixtures, prediction markets and predictions.
CREATE TYPE "SportingEventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED');
CREATE TYPE "PredictionMarketStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'SETTLED', 'VOIDED');
CREATE TYPE "PredictionStatus" AS ENUM ('ACTIVE', 'CORRECT', 'INCORRECT', 'VOIDED');

CREATE TABLE "sporting_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sport" VARCHAR(60) NOT NULL,
  "competition" VARCHAR(120) NOT NULL,
  "season" VARCHAR(40),
  "stage" VARCHAR(80),
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6),
  "status" "SportingEventStatus" NOT NULL DEFAULT 'DRAFT',
  "is_demo" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sporting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sporting_events_valid_dates" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at")
);
CREATE UNIQUE INDEX "sporting_events_slug_key" ON "sporting_events"("slug");
CREATE INDEX "sporting_events_sport_starts_at_idx" ON "sporting_events"("sport", "starts_at");
CREATE INDEX "sporting_events_competition_season_idx" ON "sporting_events"("competition", "season");
CREATE INDEX "sporting_events_status_starts_at_idx" ON "sporting_events"("status", "starts_at");

CREATE TABLE "sporting_fixtures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "external_id" VARCHAR(128),
  "name" VARCHAR(180) NOT NULL,
  "stage" VARCHAR(80),
  "round" VARCHAR(80),
  "venue" VARCHAR(160),
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "SportingEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "participant_a" VARCHAR(120),
  "participant_b" VARCHAR(120),
  "score_a" INTEGER,
  "score_b" INTEGER,
  "winner" VARCHAR(120),
  "result" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sporting_fixtures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sporting_fixtures_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "sporting_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sporting_fixtures_nonnegative_scores" CHECK (("score_a" IS NULL OR "score_a" >= 0) AND ("score_b" IS NULL OR "score_b" >= 0))
);
CREATE UNIQUE INDEX "sporting_fixtures_event_id_external_id_key" ON "sporting_fixtures"("event_id", "external_id");
CREATE INDEX "sporting_fixtures_event_id_starts_at_idx" ON "sporting_fixtures"("event_id", "starts_at");
CREATE INDEX "sporting_fixtures_status_starts_at_idx" ON "sporting_fixtures"("status", "starts_at");

CREATE TABLE "prediction_markets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fixture_id" UUID NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "market_type" VARCHAR(60) NOT NULL,
  "status" "PredictionMarketStatus" NOT NULL DEFAULT 'DRAFT',
  "lock_at" TIMESTAMPTZ(6) NOT NULL,
  "settled_at" TIMESTAMPTZ(6),
  "winning_option_id" UUID,
  "is_demo" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prediction_markets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prediction_markets_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "sporting_fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "prediction_markets_id_fixture_id_key" ON "prediction_markets"("id", "fixture_id");
CREATE UNIQUE INDEX "prediction_markets_fixture_id_slug_key" ON "prediction_markets"("fixture_id", "slug");
CREATE INDEX "prediction_markets_status_lock_at_idx" ON "prediction_markets"("status", "lock_at");

CREATE TABLE "prediction_options" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "market_id" UUID NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT "prediction_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prediction_options_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "prediction_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "prediction_options_market_id_slug_key" ON "prediction_options"("market_id", "slug");
CREATE UNIQUE INDEX "prediction_options_id_market_id_key" ON "prediction_options"("id", "market_id");
CREATE INDEX "prediction_options_market_id_sort_order_idx" ON "prediction_options"("market_id", "sort_order");
ALTER TABLE "prediction_markets" ADD CONSTRAINT "prediction_markets_winning_option_same_market_fkey"
  FOREIGN KEY ("winning_option_id", "id") REFERENCES "prediction_options"("id", "market_id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "predictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "option_id" UUID NOT NULL,
  "status" "PredictionStatus" NOT NULL DEFAULT 'ACTIVE',
  "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT "predictions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "predictions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "prediction_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "predictions_option_market_fkey" FOREIGN KEY ("option_id", "market_id") REFERENCES "prediction_options"("id", "market_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "predictions_user_id_market_id_key" ON "predictions"("user_id", "market_id");
CREATE INDEX "predictions_market_id_option_id_status_idx" ON "predictions"("market_id", "option_id", "status");
CREATE INDEX "predictions_user_id_placed_at_idx" ON "predictions"("user_id", "placed_at");

CREATE TABLE "sports_predictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "option_id" UUID NOT NULL,
  "amount" BIGINT NOT NULL DEFAULT 0,
  "potential_payout" BIGINT NOT NULL DEFAULT 0,
  "status" "PredictionStatus" NOT NULL DEFAULT 'ACTIVE',
  "idempotency_key" VARCHAR(128) NOT NULL,
  "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMPTZ(6),
  CONSTRAINT "sports_predictions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sports_predictions_positive_amounts" CHECK ("amount" >= 0 AND "potential_payout" >= 0),
  CONSTRAINT "sports_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sports_predictions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "prediction_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sports_predictions_option_market_fkey" FOREIGN KEY ("option_id", "market_id") REFERENCES "prediction_options"("id", "market_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sports_predictions_idempotency_key" ON "sports_predictions"("idempotency_key");
CREATE INDEX "sports_predictions_market_id_option_id_status_idx" ON "sports_predictions"("market_id", "option_id", "status");
CREATE INDEX "sports_predictions_user_id_placed_at_idx" ON "sports_predictions"("user_id", "placed_at");
