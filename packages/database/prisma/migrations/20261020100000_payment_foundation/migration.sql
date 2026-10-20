BEGIN;

CREATE TYPE "payment_method" AS ENUM (
    'COD', 'CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'
);
CREATE TYPE "payment_status" AS ENUM (
    'INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED',
    'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED', 'DISPUTE_OPEN', 'WON', 'LOST'
);

CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'INITIATED',
    "provider" VARCHAR(40),
    "provider_reference" VARCHAR(200),
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "payments_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "payments_provider_provider_reference_key"
    ON "payments"("provider", "provider_reference");
CREATE INDEX "payments_order_id_created_at_idx"
    ON "payments"("order_id", "created_at" DESC);
CREATE INDEX "payments_status_created_at_idx"
    ON "payments"("status", "created_at" DESC);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

COMMIT;