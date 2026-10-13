# Database setup

PostgreSQL, Redis, and Elasticsearch run via Docker Compose.

## Current repository implementation

The starter repository currently includes only the Prisma catalog foundation
(`vendors`, `categories`, `brands`, `products`, `product_approvals`,
`product_variants`, and `product_images`), not the full database history or
Docker Compose services described below. Available root commands are:

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

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Commands

```bash
cp .env.example .env
npm run docker:up
npm run db:migrate
npm run db:seed
```

`db:seed` creates default RBAC roles: `customer`, `vendor`, `admin`, `super_admin`, and others.

`db:migrate` applies the full Prisma history so the database matches `schema.prisma`, including:

1. Auth / RBAC
2. Catalog
3. Cart and orders
4. Vendor owner and staff
5. Agent eligibility, visual-search embeddings, social automation, subscriptions
6. Reviews, wishlist, loyalty, affiliates, returns, payments extras, CMS
7. Order foreign keys for reviews, reward ledger, and affiliate commissions

Check status with:

```bash
npm run db:migrate:status
```

## Without Docker

Point `DATABASE_URL` and `DIRECT_URL` in the repo-root `.env` to any PostgreSQL 17+ instance, then run migrate and seed.

Prisma CLI commands (`db:migrate`, `db:migrate:deploy`, `db:migrate:status`) run from the repo root so they pick up that `.env`.

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

Do not commit the database password. Local Docker URLs stay valid when both env vars still point at `localhost:5432`.
