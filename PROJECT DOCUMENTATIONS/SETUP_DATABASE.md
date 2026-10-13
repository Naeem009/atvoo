# Database setup

PostgreSQL, Redis, and Elasticsearch run via Docker Compose.

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
```

Enable the vector extension in the Supabase SQL editor if embeddings are used:

```sql
create extension if not exists vector;
```

Do not commit the database password. Local Docker URLs stay valid when both env vars still point at `localhost:5432`.
