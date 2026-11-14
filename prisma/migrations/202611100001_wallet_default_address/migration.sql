ALTER TABLE "users" ADD COLUMN "deposit_address" VARCHAR(64);
UPDATE "users" AS u SET "deposit_address" = ea."provider_user_id" FROM "external_accounts" AS ea WHERE ea."user_id" = u."id" AND ea."provider" = 'TRON';
CREATE INDEX "users_deposit_address_idx" ON "users"("deposit_address");
