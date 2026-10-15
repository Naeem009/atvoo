BEGIN;

ALTER TABLE "shipments"
    ADD COLUMN "shipping_amount" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "tax_amount" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    ADD CONSTRAINT "shipments_shipping_amount_check" CHECK ("shipping_amount" >= 0),
    ADD CONSTRAINT "shipments_tax_amount_check" CHECK ("tax_amount" >= 0);

ALTER TABLE "order_items"
    ADD COLUMN "tax_amount" BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT "order_items_tax_amount_check" CHECK ("tax_amount" >= 0);

COMMIT;