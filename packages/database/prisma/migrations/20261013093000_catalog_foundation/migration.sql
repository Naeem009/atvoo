BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
    unix_ts_ms bigint;
    uuid_bytes bytea;
BEGIN
    unix_ts_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
    uuid_bytes := gen_random_bytes(16);

    uuid_bytes := set_byte(uuid_bytes, 0, ((unix_ts_ms >> 40) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 1, ((unix_ts_ms >> 32) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 2, ((unix_ts_ms >> 24) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 3, ((unix_ts_ms >> 16) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 4, ((unix_ts_ms >> 8) & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 5, (unix_ts_ms & 255)::integer);
    uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
    uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

    RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- CreateEnum
CREATE TYPE "vendor_status" AS ENUM ('APPLIED', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "product_variant_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "product_approval_decision" AS ENUM ('AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "display_name" VARCHAR(160) NOT NULL,
    "status" "vendor_status" NOT NULL DEFAULT 'APPLIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "tax_class" VARCHAR(50),
    "commission_override_bps" INTEGER,
    "return_window_override_days" INTEGER,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "is_age_restricted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "is_unbranded" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "vendor_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "condition" "product_condition" NOT NULL DEFAULT 'NEW',
    "country_of_origin" CHAR(2),
    "weight_grams" INTEGER,
    "length_cm" DECIMAL(8,2),
    "width_cm" DECIMAL(8,2),
    "height_cm" DECIMAL(8,2),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_approvals" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "product_id" UUID NOT NULL,
    "reviewer_id" UUID,
    "decision" "product_approval_decision" NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "product_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "status" "product_variant_status" NOT NULL DEFAULT 'ACTIVE',
    "price" BIGINT NOT NULL,
    "compare_at_price" BIGINT,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "gtin" VARCHAR(14),
    "weight_grams" INTEGER,
    "length_cm" DECIMAL(8,2),
    "width_cm" DECIMAL(8,2),
    "height_cm" DECIMAL(8,2),
    "option_values" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT public.uuid_generate_v7(),
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID,
    "storage_path" VARCHAR(1024) NOT NULL,
    "alt_text" VARCHAR(250),
    "mime_type" VARCHAR(50) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_display_order_idx" ON "categories"("parent_id", "display_order");

-- CreateIndex
CREATE INDEX "categories_is_active_display_order_idx" ON "categories"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_is_active_name_idx" ON "brands"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_vendor_id_status_created_at_idx" ON "products"("vendor_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "products_category_id_status_created_at_idx" ON "products"("category_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "products_brand_id_status_idx" ON "products"("brand_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_vendor_id_key" ON "products"("id", "vendor_id");

-- CreateIndex
CREATE INDEX "product_approvals_product_id_created_at_idx" ON "product_approvals"("product_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "product_variants_product_id_status_idx" ON "product_variants"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_variants_vendor_id_status_idx" ON "product_variants"("vendor_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_vendor_id_sku_key" ON "product_variants"("vendor_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_id_key" ON "product_variants"("product_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_storage_path_key" ON "product_images"("storage_path");

-- CreateIndex
CREATE INDEX "product_images_product_id_display_order_idx" ON "product_images"("product_id", "display_order");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_approvals" ADD CONSTRAINT "product_approvals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_vendor_id_fkey" FOREIGN KEY ("product_id", "vendor_id") REFERENCES "products"("id", "vendor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_product_variant_id_fkey" FOREIGN KEY ("product_id", "product_variant_id") REFERENCES "product_variants"("product_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_display_name_not_blank" CHECK (length(btrim("display_name")) > 0);

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_name_not_blank" CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "categories_commission_override_bps_range"
        CHECK ("commission_override_bps" IS NULL OR "commission_override_bps" BETWEEN 0 AND 10000),
    ADD CONSTRAINT "categories_return_window_override_days_range"
        CHECK ("return_window_override_days" IS NULL OR "return_window_override_days" BETWEEN 0 AND 365);

ALTER TABLE "brands"
    ADD CONSTRAINT "brands_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "products"
    ADD CONSTRAINT "products_title_not_blank" CHECK (length(btrim("title")) > 0),
    ADD CONSTRAINT "products_physical_dimensions_positive"
        CHECK (
            ("weight_grams" IS NULL OR "weight_grams" > 0)
            AND ("length_cm" IS NULL OR "length_cm" > 0)
            AND ("width_cm" IS NULL OR "width_cm" > 0)
            AND ("height_cm" IS NULL OR "height_cm" > 0)
        );

ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_price_positive" CHECK ("price" > 0),
    ADD CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stock" >= 0),
    ADD CONSTRAINT "product_variants_physical_dimensions_positive"
        CHECK (
            ("weight_grams" IS NULL OR "weight_grams" > 0)
            AND ("length_cm" IS NULL OR "length_cm" > 0)
            AND ("width_cm" IS NULL OR "width_cm" > 0)
            AND ("height_cm" IS NULL OR "height_cm" > 0)
        );

ALTER TABLE "product_images"
    ADD CONSTRAINT "product_images_size_limit" CHECK ("byte_size" BETWEEN 1 AND 5242880),
    ADD CONSTRAINT "product_images_minimum_dimensions" CHECK ("width" >= 800 AND "height" >= 800),
    ADD CONSTRAINT "product_images_supported_mime_type"
        CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp'));

CREATE UNIQUE INDEX "brands_single_unbranded_key"
    ON "brands" ("is_unbranded")
    WHERE "is_unbranded";

CREATE UNIQUE INDEX "product_images_one_primary_per_product"
    ON "product_images" ("product_id")
    WHERE "is_primary" AND "product_variant_id" IS NULL;

CREATE UNIQUE INDEX "product_images_one_primary_per_variant"
    ON "product_images" ("product_id", "product_variant_id")
    WHERE "is_primary" AND "product_variant_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_category_tree_depth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    parent_depth integer;
    creates_cycle boolean;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    WITH RECURSIVE ancestors(id, parent_id, depth, path) AS (
        SELECT c.id, c.parent_id, 1, ARRAY[c.id]
        FROM public.categories AS c
        WHERE c.id = NEW.parent_id
        UNION ALL
        SELECT c.id, c.parent_id, a.depth + 1, a.path || c.id
        FROM public.categories AS c
        JOIN ancestors AS a ON c.id = a.parent_id
        WHERE NOT c.id = ANY(a.path)
          AND a.depth < 5
    )
    SELECT COALESCE(max(depth), 0), COALESCE(bool_or(id = NEW.id), false)
    INTO parent_depth, creates_cycle
    FROM ancestors;

    IF creates_cycle THEN
        RAISE EXCEPTION 'Category hierarchy cannot contain a cycle'
            USING ERRCODE = '23514';
    END IF;

    IF parent_depth >= 4 THEN
        RAISE EXCEPTION 'Category hierarchy cannot exceed four levels'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "categories_enforce_tree_depth"
    BEFORE INSERT OR UPDATE OF "parent_id" ON "categories"
    FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree_depth();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "vendors_set_updated_at"
    BEFORE UPDATE ON "vendors"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "categories_set_updated_at"
    BEFORE UPDATE ON "categories"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "brands_set_updated_at"
    BEFORE UPDATE ON "brands"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "products_set_updated_at"
    BEFORE UPDATE ON "products"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "product_variants_set_updated_at"
    BEFORE UPDATE ON "product_variants"
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_product_catalog_requirements(
    p_product_id uuid,
    p_vendor_id uuid,
    p_category_id uuid,
    p_product_title text,
    p_product_description text,
    p_brand_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    latest_decision public.product_approval_decision;
BEGIN
    IF char_length(btrim(p_product_title)) < 10 THEN
        RAISE EXCEPTION 'Active products require a title of at least 10 characters'
            USING ERRCODE = '23514';
    END IF;

    IF p_product_description IS NULL OR char_length(btrim(p_product_description)) < 150 THEN
        RAISE EXCEPTION 'Active products require a description of at least 150 characters'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.vendors
        WHERE id = p_vendor_id
          AND status = 'APPROVED'
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Active products require an approved vendor'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = p_category_id
          AND is_active
    ) THEN
        RAISE EXCEPTION 'Active products require an active category'
            USING ERRCODE = '23514';
    END IF;

    IF p_brand_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.brands
        WHERE id = p_brand_id
          AND is_active
    ) THEN
        RAISE EXCEPTION 'Active products require an active brand or the Unbranded record'
            USING ERRCODE = '23514';
    END IF;

    SELECT decision
    INTO latest_decision
    FROM public.product_approvals
    WHERE product_id = p_product_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF latest_decision IS NULL OR latest_decision NOT IN ('APPROVED', 'AUTO_APPROVED') THEN
        RAISE EXCEPTION 'Active products require an approved product review'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_variants
        WHERE product_id = p_product_id
          AND status = 'ACTIVE'
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Active products require at least one active variant'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_images
        WHERE product_id = p_product_id
    ) THEN
        RAISE EXCEPTION 'Active products require at least one product image'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_product_before_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        PERFORM public.validate_product_catalog_requirements(
            NEW.id,
            NEW.vendor_id,
            NEW.category_id,
            NEW.title,
            NEW.description,
            NEW.brand_id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "products_validate_before_publish"
    BEFORE INSERT OR UPDATE OF "vendor_id", "category_id", "status", "title", "description", "brand_id"
    ON "products"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_before_publish();

CREATE OR REPLACE FUNCTION public.check_product_after_catalog_child_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_product_id uuid;
    product_row record;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_product_id := OLD.product_id;
    ELSE
        affected_product_id := NEW.product_id;
    END IF;

    SELECT id, vendor_id, category_id, status, title, description, brand_id
    INTO product_row
    FROM public.products
    WHERE id = affected_product_id
    FOR UPDATE;

    IF FOUND AND product_row.status = 'ACTIVE' THEN
        PERFORM public.validate_product_catalog_requirements(
            product_row.id,
            product_row.vendor_id,
            product_row.category_id,
            product_row.title,
            product_row.description,
            product_row.brand_id
        );
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
        SELECT id, vendor_id, category_id, status, title, description, brand_id
        INTO product_row
        FROM public.products
        WHERE id = OLD.product_id
        FOR UPDATE;

        IF FOUND AND product_row.status = 'ACTIVE' THEN
            PERFORM public.validate_product_catalog_requirements(
                product_row.id,
                product_row.vendor_id,
                product_row.category_id,
                product_row.title,
                product_row.description,
                product_row.brand_id
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "product_variants_validate_parent_product"
    AFTER INSERT OR UPDATE OR DELETE ON "product_variants"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_after_catalog_child_change();
CREATE TRIGGER "product_images_validate_parent_product"
    AFTER INSERT OR UPDATE OR DELETE ON "product_images"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_after_catalog_child_change();

CREATE OR REPLACE FUNCTION public.check_product_after_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    product_row record;
BEGIN
    SELECT id, vendor_id, category_id, status, title, description, brand_id
    INTO product_row
    FROM public.products
    WHERE id = NEW.product_id
    FOR UPDATE;

    IF FOUND AND product_row.status = 'ACTIVE' THEN
        PERFORM public.validate_product_catalog_requirements(
            product_row.id,
            product_row.vendor_id,
            product_row.category_id,
            product_row.title,
            product_row.description,
            product_row.brand_id
        );
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER "product_approvals_validate_parent_product"
    AFTER INSERT ON "product_approvals"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_after_approval_change();

CREATE OR REPLACE FUNCTION public.prevent_product_approval_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'Product approval history is append-only'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "product_approvals_append_only"
    BEFORE UPDATE OR DELETE ON "product_approvals"
    FOR EACH ROW EXECUTE FUNCTION public.prevent_product_approval_mutation();

CREATE OR REPLACE FUNCTION public.prevent_active_product_slug_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.status = 'ACTIVE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION 'Published product slugs are immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "products_prevent_published_slug_change"
    BEFORE UPDATE OF "slug" ON "products"
    FOR EACH ROW EXECUTE FUNCTION public.prevent_active_product_slug_change();

ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;

INSERT INTO "brands" ("name", "slug", "is_unbranded")
VALUES ('Unbranded', 'unbranded', true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "categories" ("name", "slug", "display_order")
VALUES
    ('Electronics', 'electronics', 1),
    ('Mobiles & Accessories', 'mobiles-accessories', 2),
    ('Fashion', 'fashion', 3),
    ('Home & Kitchen', 'home-kitchen', 4),
    ('Beauty & Personal Care', 'beauty-personal-care', 5),
    ('Health & Wellness', 'health-wellness', 6),
    ('Groceries', 'groceries', 7),
    ('Sports & Outdoors', 'sports-outdoors', 8),
    ('Toys & Baby', 'toys-baby', 9),
    ('Automotive', 'automotive', 10),
    ('Books & Stationery', 'books-stationery', 11),
    ('Jewelry & Watches', 'jewelry-watches', 12),
    ('Pets', 'pets', 13),
    ('Office & Industrial', 'office-industrial', 14)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "categories" ("name", "slug", "parent_id", "display_order")
SELECT seed.name, seed.slug, parent.id, seed.display_order
FROM (
    VALUES
        ('Men', 'fashion-men', 1),
        ('Women', 'fashion-women', 2),
        ('Kids', 'fashion-kids', 3)
) AS seed(name, slug, display_order)
CROSS JOIN "categories" AS parent
WHERE parent.slug = 'fashion'
ON CONFLICT ("slug") DO NOTHING;

COMMIT;
