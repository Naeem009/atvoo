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

**Current phase:** Phase 2 — Catalog and discovery. Phase 1 passed build, lint, server-rendered HTML, image delivery, and responsive-style checks. Phase 2 starts by establishing the documented API/database catalog foundation; the current starter repository does not contain those workspaces yet. Later-phase functionality must not be presented as live until its data source, routes, and validation gates exist.

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

Copy `.env.example` to `.env.local`, then set `DATABASE_URL` to the Supabase
transaction pooler URL (port `6543`) and `DIRECT_URL` to the session pooler or
direct URL (port `5432`). Keep the database password out of source control.
Generate and validate the Prisma client/schema with:

```bash
npm run db:validate
npm run db:generate
```

After verifying that the configured project is the intended development
project, apply database migrations with `npm run db:migrate:deploy`. The initial
Prisma migration installs the UUIDv7 generator and creates the catalog tables
with row-level security enabled. RLS is default-deny until the API layer adds
explicitly scoped access.

Apply the matching Supabase migration after Prisma so both migration histories
stay aligned:

```bash
supabase db push
```

The storefront must access catalog data through the API; it must not query
Supabase directly. The current starter does not yet contain that API workspace,
so this step creates the database foundation, append-only product approval
history, and documented category/Unbranded reference rows without presenting
product data as available in the storefront.
Vendor data, product approval, Storage buckets/policies, catalog API routes, and
catalog search are not part of this initial schema.

The complete production setup, environment variables, architecture, testing, security, and deployment procedures are documented in the [Developer Handbook](PROJECT%20DOCUMENTATIONS/00_DEVELOPER_HANDBOOK.md).
