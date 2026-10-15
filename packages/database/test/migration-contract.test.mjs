import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(
  resolve(packageRoot, "prisma/schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261013093000_catalog_foundation/migration.sql",
  ),
  "utf8",
);
const supabaseRlsMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261013095000_catalog_rls.sql",
  ),
  "utf8",
);
const apiFoundationMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261013095900_catalog_api_foundation/migration.sql",
  ),
  "utf8",
);
const supabaseApiFoundationMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261013095900_catalog_api_foundation.sql",
  ),
  "utf8",
);
const productSearchMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261013100000_product_search/migration.sql",
  ),
  "utf8",
);
const cartMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261013101000_guest_cart_foundation/migration.sql",
  ),
  "utf8",
);
const supabaseCartMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261013101000_guest_cart_foundation.sql",
  ),
  "utf8",
);
const orderMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015120000_order_foundation/migration.sql",
  ),
  "utf8",
);
const supabaseOrderMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015120000_order_foundation.sql",
  ),
  "utf8",
);
const shippingTaxMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015130000_shipping_tax_configuration/migration.sql",
  ),
  "utf8",
);
const supabaseShippingTaxMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015130000_shipping_tax_configuration.sql",
  ),
  "utf8",
);
const quoteMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015140000_checkout_quotes/migration.sql",
  ),
  "utf8",
);
const supabaseQuoteMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015140000_checkout_quotes.sql",
  ),
  "utf8",
);
const orderSequenceMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015150000_order_sequence/migration.sql",
  ),
  "utf8",
);
const supabaseOrderSequenceMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015150000_order_sequence.sql",
  ),
  "utf8",
);
const orderChargeMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015160000_order_charge_breakdown/migration.sql",
  ),
  "utf8",
);
const supabaseOrderChargeMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015160000_order_charge_breakdown.sql",
  ),
  "utf8",
);
const orderTrackingMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma/migrations/20261015170000_order_tracking_token/migration.sql",
  ),
  "utf8",
);
const supabaseOrderTrackingMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261015170000_order_tracking_token.sql",
  ),
  "utf8",
);
const supabaseProductSearchMigration = readFileSync(
  resolve(
    packageRoot,
    "../../supabase/migrations/20261013100000_product_search.sql",
  ),
  "utf8",
);

test("every catalog table created in the migration has RLS enabled", () => {
  const tables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
    ([, table]) => table,
  );

  assert.deepEqual(
    tables.sort(),
    [
      "brands",
      "categories",
      "product_images",
      "product_approvals",
      "product_variants",
      "products",
      "vendors",
    ].sort(),
  );

  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
      `${table} must enable RLS in its creation migration`,
    );
    assert.match(
      supabaseRlsMigration,
      new RegExp(`ALTER TABLE IF EXISTS public\\.${table} ENABLE ROW LEVEL SECURITY`),
      `${table} must be covered by the Supabase RLS migration`,
    );
  }
  assert.doesNotMatch(migration, /CREATE POLICY/i);
  assert.doesNotMatch(supabaseRlsMigration, /CREATE POLICY/i);
});

test("catalog entities use the project UUIDv7 generator", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.uuid_generate_v7/);
  assert.equal((migration.match(/DEFAULT public\.uuid_generate_v7\(\)/g) ?? []).length, 7);
  assert.match(schema, /@default\(dbgenerated\("public\.uuid_generate_v7\(\)"\)\)/);
});

test("database constraints protect catalog money, stock, media, and taxonomy", () => {
  assert.match(migration, /CHECK \("price" > 0\)/);
  assert.match(migration, /CHECK \("stock" >= 0\)/);
  assert.match(migration, /"byte_size" BETWEEN 1 AND 5242880/);
  assert.match(migration, /"width" >= 800 AND "height" >= 800/);
  assert.match(migration, /enforce_category_tree_depth/);
  assert.match(migration, /validate_product_catalog_requirements/);
  assert.match(migration, /product_approvals_append_only/);
});

test("documented reference taxonomy and Unbranded are seeded idempotently", () => {
  assert.match(migration, /ON CONFLICT \("slug"\) DO NOTHING/);
  for (const slug of [
    "electronics",
    "mobiles-accessories",
    "fashion",
    "home-kitchen",
    "beauty-personal-care",
    "health-wellness",
    "groceries",
    "sports-outdoors",
    "toys-baby",
    "automotive",
    "books-stationery",
    "jewelry-watches",
    "pets",
    "office-industrial",
    "fashion-men",
    "fashion-women",
    "fashion-kids",
    "unbranded",
  ]) {
    assert.ok(migration.includes(`'${slug}'`), `missing documented seed ${slug}`);
  }
});

test("catalog API and search changes stay aligned across both migration histories", () => {
  assert.equal(apiFoundationMigration, supabaseApiFoundationMigration);
  assert.equal(productSearchMigration, supabaseProductSearchMigration);
  assert.match(apiFoundationMigration, /ADD COLUMN IF NOT EXISTS "approval_status"/);
  assert.match(apiFoundationMigration, /product_approvals_sync_approval_status/);
  assert.match(apiFoundationMigration, /ORDER BY created_at DESC, id DESC/);
  assert.match(productSearchMigration, /CREATE EXTENSION IF NOT EXISTS pg_trgm/);
  assert.match(productSearchMigration, /products_search_document_gin_idx/);
  assert.match(productSearchMigration, /products_title_trgm_gin_idx/);
  assert.match(schema, /searchDocument Unsupported\("tsvector"\)/);
});

test("guest cart migration stays aligned with Supabase and enforces its limits", () => {
  assert.equal(cartMigration, supabaseCartMigration);
  assert.deepEqual(
    [...cartMigration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(([, table]) => table),
    ["carts", "cart_items"],
  );
  for (const table of ["carts", "cart_items"]) {
    assert.match(
      cartMigration,
      new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
    );
  }
  assert.match(cartMigration, /DEFAULT public\.uuid_generate_v7\(\)/g);
  assert.match(cartMigration, /CHECK \("quantity" BETWEEN 1 AND 10\)/);
  assert.match(cartMigration, /CHECK \("unit_price" > 0\)/);
  assert.match(cartMigration, /UNIQUE INDEX "carts_session_id_key"/);
  assert.match(cartMigration, /ON DELETE CASCADE/);
  assert.match(cartMigration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(cartMigration, /CREATE POLICY/i);
  assert.match(schema, /model Cart \{/);
  assert.match(schema, /model CartItem \{/);
});

test("order foundation stays aligned with Supabase and enables default-deny RLS", () => {
  assert.equal(orderMigration, supabaseOrderMigration);
  const tables = [...orderMigration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
    ([, table]) => table,
  );
  assert.deepEqual(tables, [
    "orders",
    "shipments",
    "order_items",
    "stock_reservations",
    "order_status_history",
    "idempotency_keys",
  ]);

  for (const table of tables) {
    assert.match(
      orderMigration,
      new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
      `${table} must enable RLS in its creation migration`,
    );
  }
  assert.match(orderMigration, /shipments_order_id_vendor_id_key/);
  assert.match(orderMigration, /order_items_shipment_order_vendor_fkey/);
  assert.match(orderMigration, /stock_reservations_status_expires_at_idx/);
  assert.match(orderMigration, /stock_reservations_product_variant_id_idx/);
  assert.match(orderMigration, /order_items_order_id_shipment_id_vendor_id_idx/);
  assert.match(orderMigration, /order_status_history_append_only/);
  assert.match(orderMigration, /idempotency_keys_endpoint_key_key/);
  assert.match(orderMigration, /"total" = "subtotal" \+ "shipping_total" \+ "tax_total"/);
  assert.match(schema, /model Order \{/);
  assert.match(schema, /model Shipment \{/);
  assert.match(schema, /model StockReservation \{/);
  assert.match(schema, /model IdempotencyKey \{/);
  assert.doesNotMatch(orderMigration, /CREATE POLICY/i);
});

test("shipping and tax configuration stays aligned and default-deny", () => {
  assert.equal(shippingTaxMigration, supabaseShippingTaxMigration);
  const tables = [...shippingTaxMigration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
    ([, table]) => table,
  );
  assert.deepEqual(tables, [
    "shipping_profiles",
    "shipping_zones",
    "shipping_rates",
    "tax_rates",
  ]);

  for (const table of tables) {
    assert.match(
      shippingTaxMigration,
      new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
      `${table} must enable RLS in its creation migration`,
    );
  }
  assert.match(shippingTaxMigration, /shipping_rates_fields_check/);
  assert.match(shippingTaxMigration, /tax_rates_validity_check/);
  assert.match(shippingTaxMigration, /shipping_profiles_handling_days_check/);
  assert.match(schema, /model ShippingProfile \{/);
  assert.match(schema, /model ShippingZone \{/);
  assert.match(schema, /model ShippingRate \{/);
  assert.match(schema, /model TaxRate \{/);
  assert.doesNotMatch(shippingTaxMigration, /INSERT INTO "(?:shipping_|tax_)/i);
});

test("checkout quote snapshots are cart-bound, expiring, and default-deny", () => {
  assert.equal(quoteMigration, supabaseQuoteMigration);
  assert.match(quoteMigration, /FOREIGN KEY \("cart_id"\) REFERENCES "carts"\("id"\)/);
  assert.match(quoteMigration, /checkout_quotes_request_hash_check/);
  assert.match(quoteMigration, /checkout_quotes_expiry_check/);
  assert.match(quoteMigration, /checkout_quotes_cart_id_expires_at_idx/);
  assert.match(quoteMigration, /ALTER TABLE "checkout_quotes" ENABLE ROW LEVEL SECURITY/);
  assert.match(schema, /model CheckoutQuote \{/);
});

test("order number sequence is mirrored and protected by RLS", () => {
  assert.equal(orderSequenceMigration, supabaseOrderSequenceMigration);
  assert.match(orderSequenceMigration, /ALTER TABLE "checkout_quotes"[\s\S]*"consumed_at"/);
  assert.match(orderSequenceMigration, /CREATE TABLE "order_number_counters"/);
  assert.match(orderSequenceMigration, /order_number_counters_next_value_check/);
  assert.match(orderSequenceMigration, /ALTER TABLE "order_number_counters" ENABLE ROW LEVEL SECURITY/);
  assert.match(schema, /model OrderNumberCounter \{/);
  assert.match(schema, /consumedAt\s+DateTime\?/);
});

test("order charge breakdown is mirrored and nonnegative", () => {
  assert.equal(orderChargeMigration, supabaseOrderChargeMigration);
  assert.match(orderChargeMigration, /shipments_shipping_amount_check/);
  assert.match(orderChargeMigration, /shipments_tax_amount_check/);
  assert.match(orderChargeMigration, /order_items_tax_amount_check/);
  assert.match(schema, /shippingAmount BigInt/);
  assert.match(schema, /taxAmount\s+BigInt/);
});

test("guest tracking tokens are stored as a unique nullable hash", () => {
  assert.equal(orderTrackingMigration, supabaseOrderTrackingMigration);
  assert.match(orderTrackingMigration, /ADD COLUMN "tracking_token_hash" CHAR\(64\)/);
  assert.match(orderTrackingMigration, /orders_tracking_token_hash_key/);
  assert.match(schema, /trackingTokenHash\s+String\?/);
});
