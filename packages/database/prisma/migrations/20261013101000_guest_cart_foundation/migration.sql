BEGIN;

CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "session_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "cart_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" BETWEEN 1 AND 10),
    CONSTRAINT "cart_items_unit_price_check" CHECK ("unit_price" > 0)
);

CREATE UNIQUE INDEX "carts_session_id_key" ON "carts"("session_id");
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at");
CREATE UNIQUE INDEX "cart_items_cart_id_product_variant_id_key"
    ON "cart_items"("cart_id", "product_variant_id");
CREATE INDEX "cart_items_cart_id_created_at_idx"
    ON "cart_items"("cart_id", "created_at");

ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_cart_id_fkey"
    FOREIGN KEY ("cart_id") REFERENCES "carts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_product_variant_id_fkey"
    FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;

COMMIT;
