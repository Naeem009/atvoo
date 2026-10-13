# Database setup — RETIRED

This file is superseded. Database setup now targets **hosted Supabase PostgreSQL in every environment** (no local Docker Postgres/Redis/Elasticsearch by default).

See `00_DEVELOPER_HANDBOOK.md` §3 (local setup), §4 (environment variables: `DATABASE_URL` transaction pooler :6543, `DIRECT_URL` session/direct :5432), §8 (migrations, RLS) and `09_LAUNCH_READINESS_AND_OPERATIONS.md` §5 (production hardening, backups).

## Current repository implementation

The starter repository currently includes only the Prisma catalog foundation
(`vendors`, `categories`, `brands`, `products`, `product_approvals`,
`product_variants`, and `product_images`), not the full database history or
Docker Compose services described in older notes. Available root commands are:

```bash
npm run db:validate
npm run db:generate
npm run db:test
npm run db:migrate:deploy
```

The initial migration creates those tables, applies default-deny RLS and
catalog publication constraints, and inserts the documented category taxonomy
and `Unbranded` reference brand. Follow-up migrations synchronize approval
decisions and add full-text/trigram search indexes. These migrations do not
provision Storage buckets, application roles, or product data.
Configure and verify the development database URLs before running
`db:migrate:deploy`. Then run `supabase db push` to apply the matching Supabase
RLS, approval, and search migrations. Migrations have not been applied to the
linked remote project by this repository setup.

## Supabase

Prisma uses two URLs:

- `DATABASE_URL` — transaction pooler (`:6543`, `pgbouncer=true`) for the NestJS API
- `DIRECT_URL` — session pooler or direct connection (`:5432`) for `prisma migrate`

Copy both from **Project Settings → Database**. Keep `schema=public` (default on Supabase). Then:

```bash
npm run db:migrate:deploy
supabase db push
```

Enable the vector extension in the Supabase SQL editor if embeddings are used:

```sql
create extension if not exists vector;
```

Do not commit the database password.
