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
