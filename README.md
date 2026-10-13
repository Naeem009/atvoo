# ATVOO

ATVOO is a multi-vendor commerce platform for the Pakistan market, with English and PKR as the launch defaults. Product, vendor, inventory, price, and policy facts must come from the authoritative application data layer; the storefront must not ship invented catalog records.

## Source Of Truth

Read [the Developer Handbook](PROJECT%20DOCUMENTATIONS/00_DEVELOPER_HANDBOOK.md) first. It governs setup, operations, and the source-of-truth hierarchy. The numbered documents define product, data, UI, API, business, and operations requirements; when they conflict, record the discrepancy and follow the hierarchy in the handbook. The current source tree defines what is implemented today, not what the documentation says should already exist.

Before work in a feature area, read the handbook and the relevant numbered specifications. For broad platform work, read specifications `01`–`09` in the order required by `05_DEVELOPMENT_STANDARDS.md`. Social automation has its own mandatory sequence in `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` §51.

## Phased Delivery

Each phase has a written scope, a focused validation gate, and a documented result. Do not start the next phase until the current phase's gate passes. External credentials, legal/finance approvals, and production services remain prerequisites; features depending on them stay disabled until verified.

| Phase | Scope | Gate |
| --- | --- | --- |
| 1. Storefront foundation | Brand shell, accessible responsive homepage, documented design tokens, metadata | Production build, lint, server-rendered HTML and responsive review |
| 2. Catalog and discovery | Catalog data contract, categories, product pages, search, filters, JSON-LD, sitemap and crawler surfaces | API/data contract tests, no-JS SEO checks, build and accessibility checks |
| 3. Cart and order lifecycle | Guest cart, checkout quote, reservations, single buyer order with vendor shipments, tracking | Domain/state-machine tests and checkout E2E with provider sandboxes |
| 4. Customer and vendor operations | Authentication, accounts, vendor onboarding, catalog/inventory and fulfilment portals | RBAC/ownership tests, workflow integration and E2E checks |
| 5. Administration and operations | Admin workflows, CMS, finance/escrow, returns, support, audit and settings | Permission/audit tests; payout release remains flagged pending sign-off |
| 6. Launch capabilities | Notifications, loyalty, affiliates, analytics/consent, visual search, discoverability feeds, MCP and social automation | Provider/contract/security tests and feature-flag verification |
| 7. Launch readiness | Security, accessibility, performance, backups, runbooks, monitoring and go-live checklist | Handbook §12 and `09_LAUNCH_READINESS_AND_OPERATIONS.md` go-live gates |

**Current phase:** Phase 3 — Cart and order lifecycle. Phase 1 passed build, lint, server-rendered HTML, image delivery, and responsive-style checks. Phase 2 — Catalog and discovery — is complete: the Prisma catalog and NestJS API provide public product listing/search/detail, categories, and brands; the Next.js storefront renders server-side product search, filters, pagination, categories, and product pages, with canonical metadata, JSON-LD, `robots.txt`, `llms.txt`, and an API-backed `sitemap.xml`. The first Phase 3 slice is implemented: persistent guest carts with a 30-day session, API validation and stock/publication checks, price/stock change warnings, same-origin HttpOnly-cookie proxying, variant selection, and a server-rendered cart page. Cart operations do not reserve inventory. Checkout remains disabled: shipping/tax configuration, order creation, payment-provider sandbox verification, and order lifecycle are not implemented. Do not present totals, checkout, payment, or orders as available. Storefront checks include no-JS HTML, cart session/mutation flows, crawler surfaces, error/not-found states, responsive styles, and selected WCAG AA contrast ratios; this is not a browser-driven accessibility certification. Hosted Supabase integration for the new migration is unverified; do not apply migrations to a remote project without verifying the target first.

## Development

Requirements: Node.js 20 LTS or newer and npm.

```bash
npm ci
npm run dev
```

The storefront runs at `http://localhost:3000`. Before completing a phase, run the narrowest applicable check and then the required project gates:

```bash
npm run lint
npm run build
```

### Supabase catalog foundation

Copy `.env.example` to `.env`, then set `DATABASE_URL` to the Supabase
transaction pooler URL (port `6543`) and `DIRECT_URL` to the session pooler or
direct URL (port `5432`). Keep the database password out of source control.
Generate and validate the Prisma client/schema with:

```bash
npm run db:validate
npm run db:generate
```

The API also needs `SUPABASE_URL` and
`SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` (default bucket name: `product-media`).
The storefront reads catalog data server-side using `API_BASE_URL`
(`http://localhost:3001/api/v1` by default); set server-only `APP_URL` to the
canonical storefront origin for sitemap/robots URLs. Neither Supabase nor
database credentials belong in the browser.
After verifying that the configured project is the intended development
project, apply database migrations with `npm run db:migrate:deploy`. The Prisma
migrations install the UUIDv7 generator, create catalog tables, enforce
publication requirements, synchronize approval decisions, and add PostgreSQL
full-text and trigram search indexes. RLS is default-deny until the API layer
adds explicitly scoped access.

Apply the matching Supabase migration after Prisma so both migration histories
stay aligned:

```bash
supabase db push
```

Run the API locally with `npm run dev:api` (port `3001` by default). Its
versioned public endpoints are `GET /api/v1/products`,
`GET /api/v1/products/search`, `GET /api/v1/products/:idOrSlug`,
`GET /api/v1/categories`, and `GET /api/v1/brands`. The storefront must access
catalog data through the API; it must not query Supabase directly. The API
requires the public `product-media` Storage bucket for product image URLs; the
bucket must be provisioned separately for images to load. No upload or bucket
provisioning route is implemented.
Run catalog query tests with `npm run test:api`.

The complete production setup, environment variables, architecture, testing, security, and deployment procedures are documented in the [Developer Handbook](PROJECT%20DOCUMENTATIONS/00_DEVELOPER_HANDBOOK.md).
