BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "search_document" tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce("title", '')), 'A')
            || setweight(to_tsvector('english', coalesce("description", '')), 'C')
        ) STORED;

CREATE INDEX IF NOT EXISTS "products_search_document_gin_idx"
    ON "products" USING GIN ("search_document");
CREATE INDEX IF NOT EXISTS "products_title_trgm_gin_idx"
    ON "products" USING GIN ("title" extensions.gin_trgm_ops);

COMMIT;
