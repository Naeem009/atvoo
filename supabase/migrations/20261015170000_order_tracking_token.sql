BEGIN;

ALTER TABLE "orders"
    ADD COLUMN "tracking_token_hash" CHAR(64);

CREATE UNIQUE INDEX "orders_tracking_token_hash_key"
    ON "orders"("tracking_token_hash");

COMMIT;