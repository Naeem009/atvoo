BEGIN;

CREATE TYPE "shipping_rate_type" AS ENUM (
    'FLAT', 'FREE_OVER_THRESHOLD', 'WEIGHT_BASED'
);
CREATE TYPE "tax_treatment" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

CREATE TABLE "shipping_profiles" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "vendor_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "carrier_name" VARCHAR(100) NOT NULL,
    "shipping_tax_class" VARCHAR(50) NOT NULL,
    "handling_days" INTEGER NOT NULL,
    "transit_days" INTEGER NOT NULL,
    "cod_allowed" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_profiles_vendor_id_fkey"
        FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shipping_profiles_handling_days_check" CHECK ("handling_days" BETWEEN 0 AND 5),
    CONSTRAINT "shipping_profiles_transit_days_check" CHECK ("transit_days" BETWEEN 1 AND 60)
);

CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "shipping_profile_id" UUID NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_zones_shipping_profile_id_fkey"
        FOREIGN KEY ("shipping_profile_id") REFERENCES "shipping_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "shipping_rates" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "shipping_zone_id" UUID NOT NULL,
    "type" "shipping_rate_type" NOT NULL,
    "amount" BIGINT,
    "free_above_amount" BIGINT,
    "base_amount" BIGINT,
    "amount_per_kilogram" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_rates_shipping_zone_id_fkey"
        FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shipping_rates_amounts_check" CHECK (
        COALESCE("amount", 0) >= 0
        AND COALESCE("free_above_amount", 0) >= 0
        AND COALESCE("base_amount", 0) >= 0
        AND COALESCE("amount_per_kilogram", 0) >= 0
    ),
    CONSTRAINT "shipping_rates_fields_check" CHECK (
        ("type" = 'FLAT' AND "amount" IS NOT NULL
            AND "free_above_amount" IS NULL AND "base_amount" IS NULL
            AND "amount_per_kilogram" IS NULL)
        OR
        ("type" = 'FREE_OVER_THRESHOLD' AND "amount" IS NOT NULL
            AND "free_above_amount" IS NOT NULL AND "free_above_amount" > 0
            AND "base_amount" IS NULL AND "amount_per_kilogram" IS NULL)
        OR
        ("type" = 'WEIGHT_BASED' AND "amount" IS NULL
            AND "free_above_amount" IS NULL AND "base_amount" IS NOT NULL
            AND "amount_per_kilogram" IS NOT NULL)
    )
);

CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "country_code" CHAR(2) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "tax_class" VARCHAR(50) NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "treatment" "tax_treatment" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_rates_rate_bps_check" CHECK ("rate_bps" BETWEEN 0 AND 100000),
    CONSTRAINT "tax_rates_validity_check" CHECK (
        "valid_until" IS NULL OR "valid_until" > "valid_from"
    )
);

CREATE UNIQUE INDEX "shipping_profiles_vendor_id_name_key"
    ON "shipping_profiles"("vendor_id", "name");
CREATE INDEX "shipping_profiles_vendor_id_is_active_idx"
    ON "shipping_profiles"("vendor_id", "is_active");
CREATE UNIQUE INDEX "shipping_zones_shipping_profile_id_province_city_key"
    ON "shipping_zones"("shipping_profile_id", "province", "city");
CREATE INDEX "shipping_zones_province_city_idx"
    ON "shipping_zones"("province", "city");
CREATE UNIQUE INDEX "shipping_rates_shipping_zone_id_key"
    ON "shipping_rates"("shipping_zone_id");
CREATE UNIQUE INDEX "tax_rates_country_code_province_tax_class_valid_from_key"
    ON "tax_rates"("country_code", "province", "tax_class", "valid_from");
CREATE INDEX "tax_rates_country_code_province_tax_class_is_active_valid_from_idx"
    ON "tax_rates"("country_code", "province", "tax_class", "is_active", "valid_from");

ALTER TABLE "shipping_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipping_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_rates" ENABLE ROW LEVEL SECURITY;

COMMIT;