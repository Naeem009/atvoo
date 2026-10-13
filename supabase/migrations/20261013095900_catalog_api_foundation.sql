BEGIN;

ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "approval_status" "product_approval_decision" NOT NULL DEFAULT 'PENDING_REVIEW';

CREATE OR REPLACE FUNCTION public.validate_product_catalog_requirements(
    p_product_id uuid,
    p_vendor_id uuid,
    p_category_id uuid,
    p_product_title text,
    p_product_description text,
    p_brand_id uuid,
    p_approval_status public.product_approval_decision
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
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
        WHERE id = p_vendor_id AND status = 'APPROVED' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Active products require an approved vendor'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.categories
        WHERE id = p_category_id AND is_active
    ) THEN
        RAISE EXCEPTION 'Active products require an active category'
            USING ERRCODE = '23514';
    END IF;

    IF p_brand_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.brands WHERE id = p_brand_id AND is_active
    ) THEN
        RAISE EXCEPTION 'Active products require an active brand or the Unbranded record'
            USING ERRCODE = '23514';
    END IF;

    IF p_approval_status NOT IN ('APPROVED', 'AUTO_APPROVED') THEN
        RAISE EXCEPTION 'Active products require an approved product review'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_variants
        WHERE product_id = p_product_id AND status = 'ACTIVE' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Active products require at least one active variant'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_images WHERE product_id = p_product_id
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
            NEW.brand_id,
            NEW.approval_status
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_product_after_catalog_child_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    affected_product_id uuid;
    product_row record;
BEGIN
    affected_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;

    SELECT id, vendor_id, category_id, status, title, description, brand_id, approval_status
    INTO product_row FROM public.products WHERE id = affected_product_id FOR UPDATE;

    IF FOUND AND product_row.status = 'ACTIVE' THEN
        PERFORM public.validate_product_catalog_requirements(
            product_row.id, product_row.vendor_id, product_row.category_id,
            product_row.title, product_row.description, product_row.brand_id,
            product_row.approval_status
        );
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
        SELECT id, vendor_id, category_id, status, title, description, brand_id, approval_status
        INTO product_row FROM public.products WHERE id = OLD.product_id FOR UPDATE;

        IF FOUND AND product_row.status = 'ACTIVE' THEN
            PERFORM public.validate_product_catalog_requirements(
                product_row.id, product_row.vendor_id, product_row.category_id,
                product_row.title, product_row.description, product_row.brand_id,
                product_row.approval_status
            );
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_product_after_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    latest_decision public.product_approval_decision;
BEGIN
    SELECT decision
    INTO latest_decision
    FROM public.product_approvals
    WHERE product_id = NEW.product_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    UPDATE public.products
    SET approval_status = latest_decision,
        status = CASE
            WHEN latest_decision = 'REJECTED' THEN 'REJECTED'::public.product_status
            WHEN latest_decision = 'PENDING_REVIEW' THEN 'PENDING_REVIEW'::public.product_status
            ELSE status
        END
    WHERE id = NEW.product_id;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_product_after_approval_change_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    product_row record;
BEGIN
    SELECT id, vendor_id, category_id, status, title, description, brand_id, approval_status
    INTO product_row FROM public.products WHERE id = NEW.product_id FOR UPDATE;

    IF FOUND AND product_row.status = 'ACTIVE' THEN
        PERFORM public.validate_product_catalog_requirements(
            product_row.id, product_row.vendor_id, product_row.category_id,
            product_row.title, product_row.description, product_row.brand_id,
            product_row.approval_status
        );
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "product_approvals_validate_parent_product" ON "product_approvals";
DROP TRIGGER IF EXISTS "product_approvals_sync_approval_status" ON "product_approvals";
CREATE TRIGGER "product_approvals_sync_approval_status"
    AFTER INSERT ON "product_approvals"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_after_approval_change();
CREATE TRIGGER "product_approvals_validate_parent_product"
    AFTER INSERT ON "product_approvals"
    FOR EACH ROW EXECUTE FUNCTION public.check_product_after_approval_change_validate();

COMMIT;
