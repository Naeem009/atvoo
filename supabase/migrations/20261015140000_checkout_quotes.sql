BEGIN;

CREATE TABLE "checkout_quotes" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "cart_id" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "checkout_quotes_cart_id_fkey"
        FOREIGN KEY ("cart_id") REFERENCES "carts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "checkout_quotes_request_hash_check" CHECK (length("request_hash") = 64),
    CONSTRAINT "checkout_quotes_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX "checkout_quotes_cart_id_expires_at_idx"
    ON "checkout_quotes"("cart_id", "expires_at");
CREATE INDEX "checkout_quotes_expires_at_idx"
    ON "checkout_quotes"("expires_at");

ALTER TABLE "checkout_quotes" ENABLE ROW LEVEL SECURITY;

COMMIT;