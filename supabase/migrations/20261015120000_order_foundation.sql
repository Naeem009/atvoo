BEGIN;

CREATE TYPE "order_status" AS ENUM (
    'PENDING_PAYMENT', 'PAID', 'COD_CONFIRMED', 'PROCESSING',
    'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED',
    'COMPLETED', 'CANCELLED', 'FAILED_PAYMENT', 'REFUND_PENDING',
    'REFUNDED', 'PARTIALLY_REFUNDED'
);
CREATE TYPE "shipment_status" AS ENUM (
    'PENDING', 'PACKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNING',
    'RETURNED', 'LOST'
);
CREATE TYPE "stock_reservation_status" AS ENUM (
    'ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED'
);

CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_number" VARCHAR(20) NOT NULL,
    "buyer_email" VARCHAR(254) NOT NULL,
    "buyer_phone" VARCHAR(30) NOT NULL,
    "recipient_name" VARCHAR(160) NOT NULL,
    "shipping_address_line1" VARCHAR(200) NOT NULL,
    "shipping_address_line2" VARCHAR(200),
    "shipping_city" VARCHAR(100) NOT NULL,
    "shipping_province" VARCHAR(100) NOT NULL,
    "shipping_postal_code" VARCHAR(20),
    "shipping_country_code" CHAR(2) NOT NULL DEFAULT 'PK',
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" BIGINT NOT NULL,
    "shipping_total" BIGINT NOT NULL DEFAULT 0,
    "tax_total" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_subtotal_check" CHECK ("subtotal" > 0),
    CONSTRAINT "orders_shipping_total_check" CHECK ("shipping_total" >= 0),
    CONSTRAINT "orders_tax_total_check" CHECK ("tax_total" >= 0),
    CONSTRAINT "orders_total_check" CHECK (
        "total" = "subtotal" + "shipping_total" + "tax_total"
    ),
    CONSTRAINT "orders_version_check" CHECK ("version" > 0)
);

CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL DEFAULT 'PENDING',
    "tracking_number" VARCHAR(100),
    "carrier" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipments_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shipments_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "product_title" VARCHAR(150) NOT NULL,
    "variant_sku" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_shipment_order_vendor_fkey"
        FOREIGN KEY ("order_id", "shipment_id", "vendor_id")
        REFERENCES "shipments"("order_id", "id", "vendor_id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_variant_id_fkey"
        FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_quantity_check" CHECK ("quantity" BETWEEN 1 AND 10),
    CONSTRAINT "order_items_unit_price_check" CHECK ("unit_price" > 0)
);

CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "stock_reservation_status" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_reservations_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_reservations_product_variant_id_fkey"
        FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_reservations_quantity_check" CHECK ("quantity" BETWEEN 1 AND 10),
    CONSTRAINT "stock_reservations_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "order_id" UUID,
    "shipment_id" UUID,
    "order_status" "order_status",
    "shipment_status" "shipment_status",
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_status_history_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_status_history_shipment_id_fkey"
        FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_status_history_target_check" CHECK (
        ("order_id" IS NOT NULL AND "shipment_id" IS NULL
            AND "order_status" IS NOT NULL AND "shipment_status" IS NULL)
        OR
        ("order_id" IS NULL AND "shipment_id" IS NOT NULL
            AND "order_status" IS NULL AND "shipment_status" IS NOT NULL)
    )
);

CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "key" VARCHAR(100) NOT NULL,
    "endpoint" VARCHAR(200) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_keys_request_hash_check" CHECK (length("request_hash") = 64)
);

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);
CREATE UNIQUE INDEX "shipments_order_id_vendor_id_key" ON "shipments"("order_id", "vendor_id");
CREATE UNIQUE INDEX "shipments_order_id_id_vendor_id_key" ON "shipments"("order_id", "id", "vendor_id");
CREATE INDEX "shipments_vendor_id_status_created_at_idx" ON "shipments"("vendor_id", "status", "created_at" DESC);
CREATE UNIQUE INDEX "order_items_order_id_product_variant_id_key" ON "order_items"("order_id", "product_variant_id");
CREATE INDEX "order_items_order_id_shipment_id_vendor_id_idx" ON "order_items"("order_id", "shipment_id", "vendor_id");
CREATE INDEX "order_items_vendor_id_created_at_idx" ON "order_items"("vendor_id", "created_at" DESC);
CREATE UNIQUE INDEX "stock_reservations_order_id_product_variant_id_key" ON "stock_reservations"("order_id", "product_variant_id");
CREATE INDEX "stock_reservations_product_variant_id_idx" ON "stock_reservations"("product_variant_id");
CREATE INDEX "stock_reservations_status_expires_at_idx" ON "stock_reservations"("status", "expires_at");
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE INDEX "order_status_history_shipment_id_created_at_idx" ON "order_status_history"("shipment_id", "created_at");
CREATE UNIQUE INDEX "idempotency_keys_endpoint_key_key" ON "idempotency_keys"("endpoint", "key");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

CREATE FUNCTION reject_order_status_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'order status history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER order_status_history_append_only
    BEFORE UPDATE OR DELETE ON "order_status_history"
    FOR EACH ROW EXECUTE FUNCTION reject_order_status_history_mutation();

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;

COMMIT;