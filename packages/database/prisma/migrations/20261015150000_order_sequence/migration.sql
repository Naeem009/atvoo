BEGIN;

ALTER TABLE "checkout_quotes"
    ADD COLUMN "consumed_at" TIMESTAMPTZ(6);

CREATE TABLE "order_number_counters" (
    "period" CHAR(4) NOT NULL,
    "next_value" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("period"),
    CONSTRAINT "order_number_counters_next_value_check" CHECK ("next_value" > 0)
);

ALTER TABLE "order_number_counters" ENABLE ROW LEVEL SECURITY;

COMMIT;