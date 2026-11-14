DROP INDEX "withdrawals_provider_external_reference_key";
CREATE INDEX "withdrawals_provider_external_reference_idx" ON "withdrawals"("provider", "external_reference");
ALTER TABLE "withdrawals" ADD COLUMN "request_key" VARCHAR(160), ADD COLUMN "payout_tx_hash" VARCHAR(64), ADD COLUMN "payout_amount" BIGINT;
CREATE UNIQUE INDEX "withdrawals_request_key_key" ON "withdrawals"("request_key");
CREATE UNIQUE INDEX "withdrawals_payout_tx_hash_key" ON "withdrawals"("payout_tx_hash");
CREATE TABLE "deposit_intents" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "requested_amount" BIGINT NOT NULL,
  "expected_amount" BIGINT NOT NULL UNIQUE,
  "gmo_amount" BIGINT NOT NULL,
  "address" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "tx_hash" VARCHAR(64) UNIQUE
);
CREATE INDEX "deposit_intents_user_id_created_at_idx" ON "deposit_intents"("user_id", "created_at");
