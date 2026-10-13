# ATVOO Developer Handbook (v4 — Build-Ready Edition)

**Project:** ATVOO ("AI-Based Most Modern Shopping Store")
**Repository:** `atvoo`
**Audience:** Developers, technical leads, QA engineers, DevOps engineers, and AI coding agents (including Cursor)
**Document status:** Source of truth for resolved requirements and development process; implementation status is verified against the current source tree
**Supersedes:** v3 (Supabase + n8n edition); all prior versions are historical only
**Last verified:** 2026-10-13

This is the primary onboarding and operating guide for the ATVOO repository. It explains the intended system, how to run the code that exists today, and how to develop it safely. The numbered specification documents describe product requirements and target architecture; they do not prove that a feature exists. This handbook resolves requirements and documents the supported workflow. The checked-in source, tests, migrations, and package scripts are authoritative evidence of implementation. If a status claim here conflicts with that evidence, the code is the implementation source of truth and this handbook must be corrected. Deployment and remote-service status must be described as unverified until actually verified.

### Current repository baseline (verified 2026-10-13)

The repository is in **Phase 3 — Cart and order lifecycle**; the Phase 2
catalog-and-discovery exit gate passed. The current source is a root-level
Next.js storefront (`app/`) plus a small NestJS API workspace (`apps/api/`) and
a Prisma catalog workspace (`packages/database/`). The API implements public
product listing/search/detail, categories, and brands. It powers
server-rendered `/products` search/filter/pagination, `/categories` index and
category listings, and `/products/[slug]` detail pages. Product pages include
canonical metadata and Product/Offer JSON-LD; the app exposes `robots.txt`,
`llms.txt`, and an API-backed `sitemap.xml`. The storefront acceptance test
verifies no-JS HTML, crawler surfaces, API error/not-found states, responsive
styles, keyboard focus and reduced motion, and selected WCAG AA text-contrast
ratios. These checks are not a browser-driven accessibility certification.
The `notFound()` path emits `noindex`; with Next.js partial prerendering, an
HTTP 200 may be sent for a streamed not-found response. Cart, checkout, and
order lifecycle remain unimplemented.

The catalog schema, three Prisma migrations, matching Supabase SQL migrations,
API build/tests, schema validation, migration-contract tests, lint, and
storefront production build have been verified. The migration set was applied
to disposable local PostgreSQL 17 for validation. This does **not** establish
that migrations were applied to a hosted Supabase project, that Storage buckets
exist, or that production deployment/credentials are configured. Do not claim
those integrations as live without fresh evidence.

The currently supported root commands are the scripts in the root
`package.json`; the exact list is in §16.1. Commands and paths named elsewhere
in this handbook are target requirements unless they also exist in the current
source and package scripts.

## Cursor / AI-agent operating rule (binding)

Per `05_DEVELOPMENT_STANDARDS.md`, before generating code for any feature, read this handbook **and**:

```text
01_PROJECT_MASTER_SPECIFICATION.md
02_DATABASE_ARCHITECTURE.md
03_UI_UX_DESIGN_SYSTEM.md
04_API_ARCHITECTURE.md
05_DEVELOPMENT_STANDARDS.md
06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md
07_AI_AGENT_COMMERCE_READINESS.md
```

**Never make an architectural assumption that conflicts with the specifications.** Where this handbook summarizes a specification for operational convenience (most heavily in §9.6 and §9.8, which summarize `07` and `06` respectively), the numbered specification is authoritative for the details; this handbook is authoritative for how that detail maps onto infrastructure, commands, and environments. If the two genuinely disagree, stop and record the discrepancy (§ Source-of-truth hierarchy) rather than picking one silently. Generate production-ready, enterprise-grade code only — no placeholder logic presented as complete.

## 0. What changed in this revision (read this first)

v2 adapted the project to Supabase without having seen the numbered specifications. Having now read all seven, three corrections matter enough to call out before anything else:

1. **Social automation is not a minor opt-in feature — it is a full event-driven subsystem** with its own orchestration engine (n8n), transactional outbox, capability registry, approval state machine, and dead-letter handling. §9.8 and §2 now reflect this; treat `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` as required reading before touching any social/marketing module, not as background context.
2. **RBAC permissions and subscription entitlements are two different authorization axes.** A vendor user can have the `social:write` permission and still be blocked by the `social.automation.enabled` entitlement if their plan doesn't include it. Previous revisions of this handbook only modeled permissions. See §1.2.
3. **AI Agent Commerce (UCP/ACP/Perplexity) is a named, dated, protocol-specific integration**, not a vague future capability. §9.6 is rewritten around the actual protocols and a recommended low-risk MCP pilot.

The specifications continue to define Supabase PostgreSQL as the target managed database and default-deny RLS as a requirement. The current repository contains catalog migrations and API configuration for Supabase, but does not demonstrate a live hosted project, Storage upload/provisioning, n8n deployment, or canonical production deployment paths. Target architecture in this handbook must not be mistaken for shipped behavior; the repository baseline above and §10 record the verified implementation status.

v4 resolves requirements and supplies an opinionated UI/UX system (§7). “Build-ready” describes those target requirements; it does not mean the full system is implemented. Check the current repository baseline above and §10 before describing any capability as shipped.

### 0.3 Cross-document faults, resolved here

Reading `01`–`07` together surfaced three places where the specifications disagree with each other or leave a gap this handbook must close before Cursor can build without stopping to ask. Each is resolved as **binding** below; the underlying spec files are unedited, so treat this section as the authoritative reconciliation per the source-of-truth hierarchy's instruction to "record the discrepancy" rather than pick a side silently.

**Fault 1 — `02_DATABASE_ARCHITECTURE.md`'s social-automation table list is stale.** `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` §27 states explicitly that `02`'s original list (`VendorSocialAccounts, SocialAutomationRules, SocialPostQueue, SocialPostTemplates...`) "is not sufficient for the target system" and supplies a replacement. `02` was never updated to match. **Binding resolution: §8.1.1 of this handbook is the authoritative social-automation schema. Do not implement `02`'s original social-automation list.** If anyone edits `02_DATABASE_ARCHITECTURE.md` directly, replace its Social Media Automation Module section with §8.1.1's list or a pointer to it, so the two documents stop disagreeing.

**Fault 2 — the "single Order, vendor sub-orders underneath" model was only ever prose.** `01`'s market-weakness table promises this as a named differentiator; `02`'s Order Management entities (`Orders, OrderItems, OrderStatusHistory, Shipments, Returns, Refunds, Invoices`) never say how a sub-order is actually represented. **Binding resolution:** a vendor sub-order is **not** a separate top-level entity. It is the set of `OrderItems` on a single `Order` sharing the same `vendorId`, each vendor's subset gets exactly one `Shipment` (so `Shipments.vendorId` is a required, indexed column), and `OrderStatusHistory` is recorded per `Shipment` for vendor-controllable states (packed, shipped, delivered) and per `Order` for buyer-facing states (placed, paid, cancelled, completed). The customer-facing API and UI always aggregate up to the single `Order`; a vendor-facing API/UI filters down to that vendor's `Shipment` and its `OrderItems`. Do not create an `OrderSubOrder` or `VendorOrder` table — this would duplicate data `OrderItems.vendorId` and `Shipments.vendorId` already express.

**Fault 3 — `04_API_ARCHITECTURE.md` has no endpoints for the escrow/payout flow this handbook defines in §0.2.** That flow didn't exist when `04` was written. **Binding resolution — the following endpoints are added to the Admin API group (§6.3) and must be implemented alongside the escrow schema, not deferred:**

```text
GET   /admin/payouts/escrow                 list EscrowHoldings, filterable by status/vendor/date
POST  /admin/payouts/escrow/:id/release     manual release (support-resolved dispute, no-shipment digital goods)
POST  /admin/payouts/escrow/:id/reverse     manual reversal (refund/chargeback before scheduled release)
GET   /admin/payouts/batches                list VendorPayout batch runs
POST  /admin/payouts/batches/run            trigger a payout batch (gated behind the finance/legal sign-off flag, §0.2)
GET   /vendor/payouts/escrow                vendor-scoped read-only view of their own held/released escrow
```

**Also resolved, not deferred:** `SETUP_DATABASE.md` is superseded by this handbook (§3–§4). Keep it as a pointer only; do not maintain it as a second source of database setup instructions.

### 0.4 Definition of ready (standing confirmation)

This handbook resolves target requirements and cross-document contradictions; it is not evidence that those requirements have been implemented. For current implementation status, use the repository baseline above and §10. If Cursor (or a developer) hits a genuine ambiguity this document doesn't cover, fix the handbook in the same PR as the code, per §15, rather than resolving it silently in one place only.

## How to use this handbook

Read the sections in order when joining the project. For a feature change, start with the relevant domain specification, inspect the owning module and schema, then follow the change checklist in §15.

Status labels used throughout:

| Label | Meaning |
| --- | --- |
| **Implemented** | Present in the repository and usable in the documented environment. |
| **Partial** | Some code exists, but important production behavior or integration work remains. |
| **Planned** | Described by the specifications but not yet implemented or not verified in code. |
| **Prerequisite** | Requires external infrastructure, credentials, provider approval, or an operational decision. |
| **Needs confirmation** | Documentation and implementation disagree or the behavior requires an explicit product decision. |
| **Open decision** | Requires a business/legal/finance call this handbook cannot make on its own. See §0.1. |

### 0.1 Decisions (resolved defaults, and what still needs real sign-off)

Four of the five decisions this handbook previously left open have a defensible default and are resolved below so Cursor isn't blocked. One is a genuine financial/legal commitment that a document cannot make — it gets a concrete recommended model instead, explicitly gated on sign-off before it is enabled with real money.

| Decision | Resolution | Status |
| --- | --- | --- |
| n8n hosting | **n8n Cloud** for MVP — faster to start, provider handles patching/upgrades, avoids a second piece of infrastructure to operate before automation volume justifies it. Self-host (Docker, alongside the API host) remains a documented fallback if cost or data-residency requirements change later; the workflow-export discipline in §2/§9.8.3 makes that migration mechanical, not a rewrite. | **Resolved (default)** — revisit if per-execution cost or data residency becomes a constraint |
| Transactional email provider | **Resend.** Chosen for a straightforward API, good deliverability reputation, and a template model that fits password reset, order confirmation, and vendor approval emails without extra infrastructure. Implemented behind a thin provider interface (`apps/api/src/modules/notifications/email/`) so swapping providers later is a one-file change, not a rewrite. | **Resolved (default)** |
| Kubernetes vs. single-container host | **Single-container host now** (Railway/Render/Fly.io per §13.2), Dockerfile kept Kubernetes-compatible. Revisit when a concrete scale trigger is hit — sustained load that a single instance/host's autoscaling can't absorb, a multi-region requirement, or a compliance requirement for isolated node pools. Provisioning a cluster before any of those exist adds operational cost with no corresponding benefit. | **Resolved (default)** |
| Escrow / merchant-of-record model for vendor payouts | See §0.2 below — a concrete default flow is specified so the data model and API can be built now, but **enabling real payouts against it requires finance/legal sign-off**, not just engineering completion. | **Recommended default — sign-off required before production payouts** |
| Agentic checkout payment rail ownership (ATVOO vs. vendor as merchant of record) | Follows directly from the escrow decision above — whoever is merchant of record for normal checkout is merchant of record for agentic checkout too, since ACP/UCP settlement rides on the same payout model. No separate decision needed once §0.2 is signed off. | **Tied to §0.2 — no independent action required** |

### 0.2 Recommended escrow / payout model (build-ready default, pending finance/legal sign-off)

This is an engineering-usable default, not a legal opinion — a payments lawyer or licensed financial partner should confirm it against ATVOO's actual jurisdiction, payment processor agreements, and money-transmission obligations before it goes live with real funds. It exists so `Payments`, `Transactions`, `VendorPayouts`, and `EscrowHoldings` (§8.1) have a concrete flow to implement against instead of sitting as an undefined data model.

**Model: ATVOO as merchant of record, holding funds in escrow until a release trigger fires.**

```text
1. Customer pays at checkout → payment captured by ATVOO's payment processor (Stripe/JazzCash/Easypaisa).
2. Full captured amount recorded as an EscrowHoldings row per vendor sub-order, status HELD.
3. Release trigger (whichever fires first, configurable per product category):
     - delivery confirmed (from ShipmentTracking) + return window elapsed (default 7 days,
       vendor/category override allowed), OR
     - platform admin manual release (support-resolved dispute, digital goods with no
       shipment, etc.)
4. On release: EscrowHoldings status -> RELEASED, platform commission (PLATFORM_FEE_RATE)
   deducted, remainder credited to the vendor's pending payout balance.
5. VendorPayouts are batched on a fixed schedule (default: weekly) rather than released
   per-order, to keep payout volume auditable and reconcilable.
6. A refund or dispute before release reverses the EscrowHoldings row (status -> REVERSED)
   without ever reaching VendorPayouts. A refund or chargeback after release creates a
   negative adjustment against the vendor's next payout batch, never a silent balance edit.
```

This same flow is what agentic checkout (§9.6.3) settles against — an ACP/UCP order captures payment the same way a normal checkout does, so no separate payment-rail decision is needed once this model is approved.

**What still requires explicit sign-off before this is enabled for real transactions:** the escrow hold period per category, whether ATVOO's payment processor agreements actually support holding funds this way (some processors have their own hold/release mechanics that should be used instead of a parallel one), and the money-transmission/regulatory implications of ATVOO holding funds at all in its operating jurisdiction(s). Build the schema and API now; gate the production release-of-funds cron/job behind a feature flag that only finance/legal turns on.

## Source-of-truth hierarchy

When sources disagree, use this order and document the discrepancy rather than silently guessing:

1. **Runtime configuration and source code** define current application behavior.
2. **`packages/database/prisma/schema.prisma`, migrations, and the live Supabase project schema** define persisted data behavior. If the deployed Supabase schema and the migration history disagree, treat this as an incident (§14), not a documentation problem.
3. **This handbook** defines supported developer and operational procedures, and reconciles the specifications with the Supabase/n8n infrastructure decision.
4. **The numbered specifications** (`01`–`07`) define intended product, data, and integration architecture. They outrank this handbook on domain modeling, API surface, design tokens, and the SMAE/AI-agent-commerce target architecture — this handbook must be updated to match them, not the reverse.
5. **Issue and roadmap material** defines future work only.

Never describe a planned feature as production-ready merely because its name appears in a specification or schema design list.

## Contents

1. [Project orientation](#1-project-orientation)
2. [Repository layout](#2-repository-layout)
3. [Prerequisites and local setup](#3-prerequisites-and-local-setup)
4. [Configuration and environment](#4-configuration-and-environment)
5. [System architecture](#5-system-architecture)
6. [Backend development](#6-backend-development)
7. [Frontend development, UI, and UX](#7-frontend-development-ui-and-ux-complete-build-system)
8. [Database development (Supabase)](#8-database-development-supabase)
9. [Business workflows](#9-business-workflows)
10. [Feature status](#10-feature-status)
11. [Security and compliance](#11-security-and-compliance)
12. [Testing and quality](#12-testing-and-quality)
13. [Deployment and operations](#13-deployment-and-operations)
14. [Troubleshooting](#14-troubleshooting)
15. [Change checklists](#15-change-checklists)
16. [Reference](#16-reference)

---

## 1. Project orientation

ATVOO is a multi-vendor marketplace built to compete with Amazon, Etsy, Shopify Plus Marketplaces, Alibaba, Daraz, Noon, and Temu (`01_PROJECT_MASTER_SPECIFICATION.md` §1). It supports B2C commerce, multi-vendor marketplace operations, social commerce, mobile commerce, AI commerce, AI-agent commerce, visual-search commerce, and a future B2B expansion.

### 1.0 Platform modules

```text
Public Website · Customer Portal · Vendor Portal · Admin Portal
CMS · Marketing Automation · Social Media Automation Engine (vendor premium add-on)
AI Agent Commerce Layer · Visual Search Engine · Loyalty System · Affiliate System
Inventory Management · Finance Management · Search Engine · AI Recommendation Engine
Analytics System · Notification System · API Gateway · Mobile Applications
```

Every module above must be traceable to a section of this handbook or an owning spec before it is considered in scope for a given release — see the feature-status matrix (§10).

### 1.0.1 Non-functional requirement targets

These are binding acceptance criteria, not aspirations. A feature is not "done" if it silently regresses one of these:

| Requirement | Target |
| --- | --- |
| Availability | 99.9% |
| Page load time | < 2 seconds |
| Desktop PageSpeed score | > 95 |
| Mobile PageSpeed score | > 90 |
| Accessibility | WCAG 2.1 AA |
| Visual search response time (upload → embed → vector search → render) | < 2 seconds end-to-end |
| Architecture | Cloud-ready, disaster-recovery-ready, horizontally scalable |

### 1.0.2 Market weaknesses this architecture exists to close

`01_PROJECT_MASTER_SPECIFICATION.md` §13 names the specific competitor failure modes this platform is designed against — treat these as design constraints, not marketing copy, because they directly justify several "binding" rules elsewhere in this handbook:

- **Payment splitting / commission leakage** → commission math and payout holds are system-of-record (`Payments`, `Transactions`, `VendorPayouts`, `EscrowHoldings`), never manual reconciliation. See the open escrow decision in §0.1.
- **Fragmented multi-vendor orders** → the buyer sees **one Order**; vendor sub-orders and `Shipments` are generated underneath it, split invisibly on the backend. Do not design an API or UI that exposes per-vendor order fragmentation to the customer.
- **Inconsistent vendor policies** → shipping/return/refund policies are platform-level templates vendors inherit by default, with only bounded, disclosed deviations.
- **Weak search at scale** → PostgreSQL full-text search plus `pgvector` semantic/visual search, not keyword `LIKE` queries (§9.2, §9.7).
- **Not API-first** → REST API with versioning and Swagger/OpenAPI, and the AI Agent Commerce Layer (§9.6) is treated as just another channel of the same API-first design, not a bolt-on.
- **Cold-start problem** → not solvable by architecture alone; requires a launch strategy (curated vendor cohort, Store Channel social automation from day one — see Mode B in §9.8).

### 1.1 Core principles

- Treat catalog and inventory data as canonical commerce data.
- Enforce authorization in the API; frontend checks are only for user experience.
- Enforce a second, independent layer of authorization at the database via RLS default-deny policies (§8.6), even though the API's own connection bypasses RLS. This protects against misconfiguration, not against the API itself.
- Prefer server components and server-side data access for public Next.js pages.
- Keep database changes migration-driven and reversible where practical, and keep the Supabase project's live schema and the committed migration history identical at all times.
- Make external integrations opt-in, observable, rate-limited, and independently disableable.
- Preserve vendor isolation: a vendor must only access resources owned by or assigned to that vendor. This applies with equal force to n8n workflows acting on a vendor's behalf (§9.8).
- Keep customer, payment, OAuth, and operational secrets out of logs and source control. Treat the Supabase **service role key** and any **n8n service credential** with the same severity as a database superuser password.
- AI-generated output — captions, hashtags, recommendations, summaries — is untrusted until validated against authoritative ATVOO data. This applies everywhere AI touches the platform (social captions, AI search, review summaries), not only in the social automation engine where the specification states it explicitly.

### 1.2 User roles, permissions, and entitlements

Three distinct concepts govern what an operation is allowed to do. Conflating them is the single most common authorization bug in a marketplace codebase — keep them separate in code as well as in this table.

| Concept | Answers | Checked by | Example |
| --- | --- | --- | --- |
| **Role** | Who is this user, broadly? | Assignment at signup/invite time | Vendor owner |
| **Permission** | Is this user allowed to perform this operation at all? | RBAC guard against the `Permission` enum (§1.2.1) | `social:write` |
| **Entitlement** | Does this vendor's subscription plan include this capability right now? | Entitlement guard against the vendor's active subscription (§1.2.2) | `social.automation.enabled` |

The authorization chain for any vendor-scoped mutation, per `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` §7 (and applied project-wide, not only to social automation):

```text
Authenticated user
→ vendor membership
→ vendor permission (RBAC)
→ subscription entitlement
→ resource ownership (social account, rule, order, product, etc.)
→ requested operation
```

Changing an ID in a request must never allow cross-vendor access, at any step in this chain.

| Role | Responsibility |
| --- | --- |
| Guest | Browse public content and maintain a guest cart using a session header. |
| Customer | Purchase products, manage account data, orders, reviews, returns, and rewards. |
| Vendor owner | Manage a vendor store, catalog, inventory, orders, staff, and eligible marketing features. |
| Vendor staff | Perform assigned vendor operations without owner-level access. |
| Affiliate | Refer traffic and receive eligible commissions. |
| Support agent | Handle customer and order support within assigned permissions. |
| Inventory manager | Manage stock, warehouses, reservations, and inventory operations. |
| Marketing manager | Manage CMS, campaigns, store social channels, and merchandising. |
| Finance manager | Manage payments, refunds, payouts, commissions, and financial reporting. |
| Admin | Manage platform operations within assigned RBAC permissions. |
| Super admin | Full platform administration and emergency controls. |

**Target requirement only:** when application seeding and RBAC are implemented, seed these roles under stable slugs (`customer`, `vendor_owner`, `vendor_staff`, `affiliate`, `support_agent`, `inventory_manager`, `marketing_manager`, `finance_manager`, `admin`, `super_admin`) with fixed permission sets. The current schema/API does not implement roles or this seed data.

#### 1.2.1 Permission model (binding — implement exactly this)

```text
catalog:read        catalog:write        catalog:approve
inventory:read       inventory:write
orders:read           orders:write         orders:refund
payouts:read          payouts:write
vendor:staff:manage
customers:read        customers:write
cms:read               cms:write
settings:write
social:read             social:write        social:publish
reports:read
admin:emergency
```

Each role in §1.2 maps to a fixed, seed-defined set of these permissions. A guard checks the permission, never the role literal, except where a route is explicitly `Super admin`-only (`admin:emergency`). Extend, never rename, once shipped.

#### 1.2.2 Entitlement model (binding — separate from permissions)

Per `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` §6: **do not hard-code business behavior around tier names.** Check dot-namespaced entitlement keys, resolved server-side from the vendor's active subscription. The API decides entitlement — never the frontend, never n8n.

```text
social.manual_publish
social.connected_accounts.max
social.automation.enabled
social.ai_generation
social.approval_workflow
social.best_time
social.analytics
social.ab_testing
social.custom_cadence
```

Suggested commercial mapping (Starter → manual share only; Growth → scheduled posting, limited destinations, standard AI generation; Premium → multi-platform automation, event triggers, AI content/asset selection, best-time, advanced analytics; Enterprise → Premium + A/B variants, custom cadence/governance, advanced isolation). Treat plan names as a seed/pricing-table concern that maps onto entitlement keys — never branch application logic on the plan name string itself.

### 1.3 Revenue model and scope

Commissions, vendor subscriptions, sponsored placement, advertising, affiliate commissions, gift cards, memberships, and the Social Media Automation add-on (tiered, per vendor) are the named revenue streams. Each stream must be checked against the feature-status table (§10) before implementation or release planning.

---

## 2. Repository layout and source ownership

The following is the current tracked application layout. Paths that appear in
the target-architecture sections are requirements, not additional workspaces.

```text
atvoo/
├── app/                        Root Next.js App Router (currently homepage only)
├── public/                     Static assets
├── apps/
│   └── api/                    NestJS catalog REST API and tests
├── packages/
│   └── database/               Prisma schema, migrations, and migration tests
├── supabase/
│   └── database/               Prisma schema and migrations
├── PROJECT DOCUMENTATIONS/     Developer handbook and numbered specifications
├── package.json                Root scripts and npm workspaces
├── package-lock.json           Root lockfile
├── .env.example                Environment variable template
└── next.config.ts              Next.js configuration
```

### 2.1 Workspace responsibilities

**`app/`** is the root Next.js App Router application. The current route is
`app/page.tsx`; catalog pages and API integration remain to be implemented.

**`apps/api`** is the current NestJS public catalog API. It implements public
product list/search/detail, categories, and brands. Authentication, RBAC,
commerce, administration, uploads, and the other modules described in the
specifications are target work, not current functionality.

**`packages/database`** owns the current Prisma catalog schema and migration
history. There is no application seed script.

**`supabase/migrations/`** contains raw SQL counterparts to the Prisma
migrations for catalog policies and search. A directory of migration files
does not establish that a hosted project has received them.

### 2.2 Dependency direction

```text
Next.js storefront ──(server-side catalog requests)──> NestJS API
NestJS API ──> Prisma catalog schema ──> PostgreSQL
```

The intended boundary is binding: the browser-facing app accesses catalog data
through the API, not directly through Supabase. The homepage and catalog
storefront use this integration. The broader n8n, shared package, and commerce
boundaries below remain target architecture.

### 2.3 Important source locations

| Concern | Location |
| --- | --- |
| Web routes and layout | `app/` |
| Web global styles | `app/globals.css` |
| API bootstrap and global configuration | `apps/api/src/main.ts` |
| API module composition | `apps/api/src/modules/api.module.ts` |
| API catalog controller/service | `apps/api/src/modules/catalog/` |
| API tests | `apps/api/test/` |
| Prisma schema | `packages/database/prisma/schema.prisma` |
| Prisma migrations | `packages/database/prisma/migrations/` |
| Supabase SQL migrations | `supabase/migrations/` |
| Database migration contract tests | `packages/database/test/` |
| Root scripts and workspaces | `package.json` |
| Environment variable names/placeholders | `.env.example` |

---

## 3. Prerequisites and local setup

### 3.1 Required tools

- Node.js 20 LTS or newer. The repository does not currently include a `.nvmrc`.
- npm with workspace support.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) only when applying the raw SQL migrations to a linked Supabase project.
- Git.
- A disposable PostgreSQL 17 database for local migration validation, or an explicitly selected Supabase development project when remote integration is intended. Never develop against the production project.

### 3.2 First-time setup (standard path)

1. Choose a disposable local PostgreSQL 17 database or a Supabase development project. Current catalog migrations manage the required search extensions; `pgvector` is not used by the current implementation.
2. Configure `DATABASE_URL` for API runtime and `DIRECT_URL` for Prisma CLI migrations. Do not put real credentials in source control.
3. Configure `SUPABASE_URL` and `SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` for the current catalog API. The current API constructs public media URLs; it does not upload files or provision buckets.
4. Configure server-side `API_BASE_URL` to the NestJS base URL ending in `/api/v1`. For a local API, use `http://localhost:3001/api/v1`. Set server-only `APP_URL` to the storefront origin for sitemap and crawler metadata; it is read at request time and must not be prefixed with `NEXT_PUBLIC_`.

```bash
cp .env.example .env
# Fill in only the environment values required for the task.
npm ci
npm run db:validate
npm run db:generate
npm run lint
npm run build
npm run build:api
npm run test:api
npm run db:test
```

Only after confirming that the configured database is the intended development
project and reviewing the migration diff, apply Prisma migrations with
`npm run db:migrate:deploy`. Apply matching SQL migrations to the explicitly
linked Supabase project with `supabase db push`. Neither command provisions
Storage buckets; the current repository has no Storage bootstrap command.

Start the currently implemented applications in separate terminals:

```bash
npm run dev
npm run dev:api
```

Default URLs:

| Service | URL |
| --- | --- |
| Storefront | `http://localhost:3000` |
| API base | `http://localhost:3001/api/v1` |
| Swagger UI | `http://localhost:3001/api/docs` |
| Health endpoint, Redis, n8n | Not implemented/configured in this repository baseline |

### 3.3 Offline fallback (no Supabase connectivity)

There is no checked-in Docker Compose configuration in the current repository.
For isolated migration testing, use an explicitly disposable PostgreSQL 17
instance, and stop/remove that instance when validation completes. This does
not validate hosted Supabase configuration, Storage, production credentials,
or deployment.

### 3.4 Installation lifecycle

The current root install does not define a `postinstall` lifecycle, a shared
package build, or a database package build. Generate the Prisma client
explicitly after installing dependencies:

```bash
npm ci
npm run db:generate
```

Do not treat generated client files as application source. Verify package
installation and generation when a clean install does not produce a working
client.

### 3.5 Seed data

There is no current `db:seed` command or application seed script. The first
catalog migration seeds reference categories and the `Unbranded` brand only;
it does not create demo accounts, vendors, or products. Never rely on the
example/demo credentials documented in older revisions.

---

## 4. Configuration and environment

The root `.env.example` contains the current environment template. It is not a
complete inventory for the target architecture. Never commit `.env` or
provider credentials.

### 4.1 Variable reference

| Variable | Consumer | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | API startup and Prisma | Required by API | Database URL; the API checks presence. Configure a suitable Supabase pooler or PostgreSQL connection string for the selected environment. |
| `DIRECT_URL` | Prisma CLI | Required for migration operations | Direct/session PostgreSQL connection used by Prisma migrations. |
| `SUPABASE_URL` | API startup / media URL construction | Required by API | HTTP(S) Supabase project URL. The current API does not use the service-role key. |
| `SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` | API startup / media URL construction | Required by API | Bucket name used when forming product image URLs. This does not provision the bucket or implement uploads. |
| `CORS_ORIGIN` | API | Optional | Comma-separated allowed origins; if unset, CORS origins are disabled. |
| `API_PORT` | API | Optional | Defaults to `3001`. |
| `API_BASE_URL` | Next.js server | Optional | Defaults to `http://localhost:3001/api/v1`; set to the reachable API origin in deployment. Never prefix with `NEXT_PUBLIC_`. |
| `APP_URL` | Next.js sitemap/robots | Optional | Defaults to `http://localhost:3000`; set to the canonical public storefront origin. Server-only so a promoted build can use its runtime origin. |
| `SUPABASE_SERVICE_ROLE_KEY` | Not currently consumed | No | Present as an empty placeholder in `.env.example`; any future use must remain server-only and must not bypass intended authorization. |

The root Next.js homepage does not require API connectivity. Catalog pages
require the API to be reachable through `API_BASE_URL`; API failures render an
explicit retry state. The API does not implement project-ref matching or
production placeholder checks.

### 4.2 Environments and project separation

Separate development, staging, and production projects/credentials are target
operational requirements, not environments currently configured by this
repository. Never use a production database for local testing.

### 4.3 Secret handling

Generate secrets with a password manager or a cryptographically secure
generator. Store credentials in the selected host's secret manager, never in
repository files. Rotate compromised secrets, invalidate affected
sessions/tokens where applicable, and record the incident (§11.3).

---

## 5. System architecture

The architecture below describes the target platform. The current implementation
is the smaller catalog slice described in the repository baseline and §10.

### 5.1 Target request flow

```mermaid
flowchart LR
  Browser[Browser] --> Web[Next.js storefront]
  Web --> API[NestJS API /api/v1]
  API --> Guards[JWT + RBAC + entitlement guards]
  Guards --> Services[Feature services]
  Services --> Prisma[Prisma client]
  Prisma -- pooled 6543 / direct 5432 --> Supa[(Supabase PostgreSQL + pgvector)]
  Services -- service-role client --> Storage[(Supabase Storage)]
  Services -. cache/queue .-> Redis[(Upstash Redis)]
  Services -- outbox event --> Outbox[(Transactional outbox table)]
  Outbox --> Dispatcher[Outbox dispatcher]
  Dispatcher -- signed webhook --> N8N[n8n orchestration]
  N8N -- scoped service credential --> API
  N8N --> Adapters[Platform adapters: Meta, Pinterest, TikTok, X, Google Business]
```

This is a target, not a depiction of currently wired integrations. The current
catalog API uses PostgreSQL full-text/trigram search; visual search, pgvector
queries, Redis, the outbox, n8n, platform adapters, JWT/RBAC/entitlement guards,
and Supabase Storage uploads are not implemented. n8n must never mutate
production tables directly when that target subsystem is built.

### 5.2 Current API bootstrap

`apps/api/src/main.ts` requires `DATABASE_URL`, `SUPABASE_URL`, and
`SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA`. It configures CORS from
`CORS_ORIGIN`, validates or generates a request ID, applies the `/api/v1`
prefix, installs a transforming/whitelisting global `ValidationPipe`, a
structured exception filter, Swagger at `/api/docs`, and shutdown hooks. The
API listens on `API_PORT` or port `3001`. It does not currently configure
authentication, rate limiting, JWT/RBAC/entitlement guards, project-ref
validation, or a health route.

### 5.3 Current API module and routes

The current Nest module composition is `apps/api/src/modules/api.module.ts`
with catalog and Prisma modules. Implemented public routes are:

```text
GET /api/v1/products
GET /api/v1/products/search
GET /api/v1/products/:idOrSlug
GET /api/v1/categories
GET /api/v1/brands
```

Swagger is available at `/api/docs`. This inventory is not the full API
specified in `04_API_ARCHITECTURE.md`.

### 5.4 Current web routes

The Next.js application is at the repository root. Implemented storefront
routes include `/`, `/products`, `/products/[slug]`, `/categories`,
`/categories/[slug]`, `/robots.txt`, `/sitemap.xml`, and `/llms.txt`.
`app/layout.tsx` and `app/globals.css` provide the root layout and styles;
`app/not-found.tsx` provides the not-found UI. Account, cart, checkout, portal,
and legal routes in `01_PROJECT_MASTER_SPECIFICATION.md` remain target work.

---

## 6. Backend development

### 6.1 Module pattern (Clean Architecture / DDD, per `05_DEVELOPMENT_STANDARDS.md`)

A feature belongs in `apps/api/src/modules/<feature>/` and contains:

- A Nest module declaring imports, controllers, and providers.
- **Controllers** — transport and route decorators only. No business logic.
- **Services** — business rules and orchestration (the domain layer).
- **DTOs** — validated input and output shaping.
- **Guards/decorators** — authentication, RBAC permission, and entitlement checks where required (§1.2).
- **Repository-pattern boundary** — a clear service-facing interface around Prisma access, so domain logic is not directly coupled to ORM query shapes. This is a specification requirement (`05` — Repository Pattern, SOLID, Dependency Injection), not a style preference; new modules should not bypass it by calling `this.prisma.model.findMany()` throughout the service body without an intermediate repository method.

Do not trust IDs supplied by clients without applying ownership and authorization filters in the database query.

### 6.2 Endpoint conventions (binding contracts)

- Versioned API routes use `/api/v1`, matching the full path inventory in `04_API_ARCHITECTURE.md` (auth, customer, vendor, vendor-social-automation, store-social-automation, AI-agent-commerce, product, order, CMS, and admin groups — see §6.3).
- **Pagination:** `page` (default `1`), `pageSize` (default `20`, max `100`):
  ```json
  { "data": [ /* items */ ], "meta": { "page": 1, "pageSize": 20, "total": 143, "totalPages": 8 } }
  ```
- **Error shape**, produced by the global exception filter:
  ```json
  { "error": { "code": "VALIDATION_FAILED", "message": "Human-readable summary", "details": [ /* optional field-level errors */ ], "requestId": "uuid" } }
  ```
  Stable codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.
- **Idempotency:** per `04_API_ARCHITECTURE.md`'s explicit rule ("Idempotency Keys on Queue/Publish Endpoints"), retryable mutation endpoints (payment capture, order creation, social queue/publish actions) accept an `Idempotency-Key` header (client-generated UUID). Persist `(key, endpoint, response)` and replay the stored response on a repeated key.
- **Rate limits (defaults, tune with measured traffic):** unauthenticated — 60 req/min/IP; authenticated — 300 req/min/user; auth endpoints — 10 req/min/IP; inbound social webhooks — per-platform limit set by the platform adapter, not the global default.
- **Subscription tier gate guards** (`04` — explicit API rule): any route gated by an entitlement key (§1.2.2) uses a dedicated guard, checked after the RBAC guard, never inferred from role alone.
- **Webhook signature verification** is mandatory per platform (`04`, `06` §38): HMAC signature + timestamp + nonce + event/idempotency ID. Reject invalid signatures before expensive processing; acknowledge quickly, process asynchronously.
- Apply `@Public()` only to endpoints intentionally public. Apply permission and entitlement checks at the API boundary for vendor/admin/finance/support operations.

### 6.3 Current endpoint groups

Match `04_API_ARCHITECTURE.md` exactly; the running Swagger document is the authoritative generated contract, this is the specified inventory:

| Group | Representative paths |
| --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/social-login` |
| Customer | `/customers`, `/customer/profile`, `/customer/orders`, `/customer/wishlist`, `/customer/addresses`, `/customer/reviews`, `/customer/rewards`, `/customer/support` |
| Vendor | `/vendors`, `/vendor/profile`, `/vendor/products`, `/vendor/orders`, `/vendor/inventory`, `/vendor/payouts`, `/vendor/analytics`, `/vendor/staff` |
| Vendor social automation (Premium) | `/vendor/social-accounts`, `/vendor/social-accounts/connect/:platform`, `/vendor/social-accounts/disconnect/:platform`, `/vendor/social-automation/rules[/:id]`, `/vendor/social-automation/queue[/:id/approve\|reject]`, `/vendor/social-automation/generate-post`, `/vendor/social-automation/analytics`, `/social/webhooks/:platform` |
| Store social automation (Admin/Marketing) | `/admin/store-social/accounts[/connect/:platform]`, `/admin/store-social/curation-rules`, `/admin/store-social/queue[/:id/approve\|edit\|reject]`, `/admin/store-social/sponsored-slots`, `/admin/store-social/fairness-report`, `/admin/store-social/analytics`, `/vendor/store-social/opt-in`, `/vendor/store-social/tag-handle`, `/vendor/store-social/exclude-product/:productId`, `/vendor/store-social/performance` |
| AI agent commerce (public, machine-readable) | `/.well-known/commerce-manifest.json`, `/feeds/ucp`, `/feeds/acp`, `/feeds/perplexity`, `/llms.txt`, `/admin/agent-commerce/eligibility`, `/admin/agent-commerce/feed-status`, `/analytics/agent-attribution` |
| Product | `/products`, `/products/search`, `/products/visual-search`, `/products/filter`, `/products/recommendations`, `/products/compare`, `/products/reviews`, `/products/questions` |
| Order | `/orders`, `/orders/create`, `/orders/payment`, `/orders/track`, `/orders/return`, `/orders/refund` |
| CMS | `/pages`, `/blogs`, `/faqs`, `/banners`, `/menus` |
| Admin | `/admin/vendors`, `/admin/customers`, `/admin/orders`, `/admin/products`, `/admin/payments`, `/admin/reports`, `/admin/settings` |
| **Escrow and payouts (added by this handbook, §0.3 Fault 3 — not in `04`)** | `/admin/payouts/escrow`, `/admin/payouts/escrow/:id/release`, `/admin/payouts/escrow/:id/reverse`, `/admin/payouts/batches`, `/admin/payouts/batches/run`, `/vendor/payouts/escrow` |

Note the last row: it does not appear in `04_API_ARCHITECTURE.md` because the escrow/payout flow (§0.2) postdates that spec. Treat it with the same binding weight as the rest of this table — it is not optional or lower-priority merely because it originates here rather than in `04`.

### 6.4 Adding an API feature

1. Read the relevant numbered specification and this handbook.
2. Identify the owning module, database models, required permission (§1.2.1), and required entitlement if any (§1.2.2) — add new enum values there first if none fit.
3. Define DTOs and authorization rules before implementing the service.
4. Add service methods behind a repository-pattern boundary (§6.1), with ownership, validation, and transaction boundaries.
5. Add controller routes and Swagger metadata, following §6.2's contracts.
6. Add or update shared response types if web consumers need them.
7. Add tests for success, invalid input, unauthenticated access, unauthorized ownership, missing entitlement, and failure/retry paths.
8. If the feature touches tables directly (new model), add the corresponding RLS default-deny policy in the same PR (§8.6).
9. Update this handbook only when the supported behavior is verified.

---

## 7. Frontend development, UI, and UX (complete build system)

`03_UI_UX_DESIGN_SYSTEM.md` specifies philosophy, color tokens, typography family, and a page-by-page feature inventory — it does not specify a typographic scale, spacing/grid system, component states, breakpoints, or interaction patterns, because a product spec isn't expected to. Those gaps would otherwise stop Cursor mid-build waiting for a judgment call. §7.3–§7.7 close them with resolved, opinionated defaults, chosen to fit the stated philosophy (premium, clean, fast, trustworthy, mobile-first — benchmarked against Apple, Nike, Stripe, Shopify Plus, Linear, Amazon) and the existing token set. Treat everything in this section as binding, the same as `03`'s own content — this is an extension of that spec, not a lower-priority alternative to it.

### 7.1 Next.js rules

- The current Next.js app is rooted at `app/`; `apps/web/` is not a repository path.
- Use the App Router; prefer Server Components for data loading and static structure; `"use client"` only when state, event handlers, browser APIs, or client-only libraries require it.
- Keep secrets and server-only API calls out of client components.
- When wiring the catalog, route requests through the NestJS API. No shared API helper or storefront catalog integration exists yet.
- Preserve route-level metadata, loading states, error boundaries, and accessible empty states.
- Treat URL search parameters as part of the page contract for search, filters, pagination, and shareable views.
- Never import `@supabase/supabase-js` or reference Supabase keys in the web app; all catalog data access must go through the API.

### 7.2 Design tokens (binding, per `03_UI_UX_DESIGN_SYSTEM.md`)

Design philosophy: premium, clean, modern, fast, trustworthy, mobile-first, conversion-focused.

| Token | Light value | Dark value (resolved default — `03` requires dark mode but names only light-mode colors) |
| --- | --- | --- |
| Primary | `#0F172A` | `#E2E8F0` |
| Accent | `#2563EB` | `#3B82F6` |
| CTA | `#F97316` | `#FB923C` |
| Success | `#16A34A` | `#22C55E` |
| Warning | `#F59E0B` | `#FBBF24` |
| Error | `#DC2626` | `#F87171` |
| Background | `#FFFFFF` | `#0B1220` |
| Surface | `#F8FAFC` | `#111827` |
| Border | `#E2E8F0` | `#1F2937` |
| Text | `#0F172A` | `#F1F5F9` |
| Muted | `#64748B` | `#94A3B8` |

Dark-mode values are this handbook's resolved target default (chosen to preserve the same relative contrast and hue relationships as the light set) — if `03_UI_UX_DESIGN_SYSTEM.md` is later amended with explicit dark-mode hex values, those take precedence and this row should be updated to match. Primary font **Inter**, fallback **Geist**, are the target font stack. Implement the tokens in root `app/globals.css` (and add a separate token module only if needed); do not assume a token module, theme switcher, or these exact values are already present in the current homepage.

### 7.3 Typography, spacing, layout, and elevation scales (resolved defaults — not specified in `03`)

**Type scale** (size / line-height / weight):

| Role | Size / line-height | Weight | Use |
| --- | --- | --- | --- |
| Display | 48px / 56px | 700 | Hero headlines only |
| H1 | 36px / 44px | 700 | Page titles |
| H2 | 30px / 38px | 700 | Section titles |
| H3 | 24px / 32px | 600 | Card/group titles |
| H4 | 20px / 28px | 600 | Sub-section titles |
| H5 | 18px / 26px | 600 | Emphasized labels |
| H6 | 16px / 24px | 600 | Small headings |
| Body-lg | 18px / 28px | 400 | Lead paragraphs |
| Body (base) | 16px / 24px | 400 | Default text |
| Body-sm | 14px / 20px | 400 | Secondary text, form hints |
| Caption | 12px / 16px | 500 | Labels, metadata, timestamps |

Mobile scales down one step for Display/H1/H2 only (Display→36px, H1→30px, H2→26px); H3 and below stay constant across breakpoints, since further shrinking hurts legibility more than it helps density.

**Spacing scale:** 4px base unit — `0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96` px (matches Tailwind's default scale; do not invent a parallel scale in component code).

**Breakpoints** (mobile-first — base styles target the smallest width, wider rules layer on top): `sm 640px · md 768px · lg 1024px · xl 1280px · 2xl 1536px`.

**Containers and grid:** max content width `1280px` (the `xl` breakpoint), horizontal padding `16px` below `md`, `24px` `md`–`lg`, `32px` at `lg`+. Desktop layouts use a 12-column grid; product/category grids specifically use `2` columns below `sm`, `3` at `sm`–`md`, `4` at `lg`, `5` at `xl`+.

**Radius scale:** `sm 6px` (badges, chips) · `md 8px` (buttons, inputs, small cards) · `lg 12px` (cards, panels) · `xl 16px` (modals, sheets) · `full 9999px` (avatars, pills).

**Elevation (shadow) scale:** `0` flat (default surface) · `1` `0 1px 2px rgba(15,23,42,0.06)` (hover on a card) · `2` `0 4px 12px rgba(15,23,42,0.10)` (dropdown, popover) · `3` `0 12px 32px rgba(15,23,42,0.16)` (modal, dialog) · `4` `0 20px 48px rgba(15,23,42,0.22)` (toast). Dark mode: same offsets, opacity raised roughly 1.5x since dark surfaces need a stronger shadow to read as elevated.

**Z-index scale:** `base 0 · sticky-header 10 · dropdown 20 · overlay-backdrop 30 · modal 40 · toast 50 · tooltip 60`. Never assign an ad hoc z-index outside this scale.

**Motion:** durations `150ms` (hover/focus micro-interactions), `250ms` (dropdown/accordion/tab transitions), `350ms` (modal/sheet enter-exit, page-level transitions). Easing: `ease-out` for entrances, `ease-in` for exits. Respect `prefers-reduced-motion: reduce` — disable non-essential transitions/animations (parallax, decorative motion) when set; keep only functionally necessary state changes (e.g., an instant swap instead of a slide).

### 7.4 Component library and stack (resolved default)

- **Styling:** Tailwind CSS, configured to read the CSS-variable tokens in §7.2 rather than hardcoded Tailwind theme colors, so dark mode and any future rebrand is a token change, not a find-and-replace across components.
- **Interactive primitives:** shadcn/ui components built on Radix UI primitives (dialog, dropdown-menu, popover, tabs, select, toast, sheet, tooltip). Chosen because they're accessible by default (keyboard nav, focus management, ARIA roles already correct) which materially de-risks the WCAG 2.1 AA target (§1.0.1), and because they're copied into the codebase rather than imported as an opaque dependency, so they can be restyled to the token system in §7.2 without fighting a third-party visual language.
- **Icons:** `lucide-react` — consistent stroke weight, tree-shakeable, and shadcn/ui's default icon set, so no second icon language enters the product.
- **Do not** introduce a second component kit, icon library, or CSS methodology (e.g., CSS Modules alongside Tailwind) without updating this section — component visual consistency depends on there being exactly one system in play.

### 7.5 Component states and interaction patterns (binding for every interactive component)

Every interactive component must implement all of the following, not just default and hover — a component missing loading/error/disabled states is not complete, per §7.9:

`default · hover · focus-visible (visible ring using the Accent token, never suppressed) · active/pressed · disabled (reduced opacity, no pointer events, no focus) · loading (skeleton or inline spinner, never a blank flash) · error (Error-token border and text, inline message) · success (Success-token feedback, e.g. a field after a valid async check)`.

**Forms:** label always visible above the input — never placeholder-as-label, since the label disappears the moment the user types and fails accessible-name requirements. Validate on blur, not on every keystroke (keystroke-level validation reads as flickering/hostile). Error messages sit directly under the field, linked via `aria-describedby`, in the Error token. Required fields are marked explicitly (not color-only). Submit buttons show a loading state and are disabled during an in-flight request — never double-submittable. Successful submission gets an explicit confirmation (inline message or toast), never a silent success.

**Notifications/toasts:** desktop — bottom-right, stacked, max 3 visible; mobile — full-width, bottom, above the tab bar. Success/info auto-dismiss after 4-6s; errors persist until manually dismissed. Announced via `aria-live="polite"` (`assertive` for errors) so screen-reader users aren't dependent on seeing the toast appear.

**Modals vs. drawers/sheets:** use a centered modal (backdrop, focus-trapped, `Escape` closes, focus returns to the trigger element on close) for confirmations and short single-purpose forms. Use a drawer/sheet — slides from the right on desktop, from the bottom on mobile — for longer forms (e.g., the vendor product-edit form on a mobile viewport, filter panels on the PLP). This reconciles the desktop-centric modal pattern with the mobile-first requirement instead of forcing one pattern everywhere.

**Loading, skeleton, empty, and error states — required on every data-driven view:** initial load shows a skeleton matching the final layout's shape (card grid → skeleton cards, list → skeleton rows) — never a bare spinner for content whose shape is already known. Empty states show a one-line explanation plus a primary action (e.g., "No orders yet" → *Start shopping*; "No products match your filters" → *Clear filters*) — never a blank area with no next step. Error states show a retry action and a plain-language message — never a raw stack trace, an error code with no explanation, or a generic "Something went wrong" that gives the user nothing to do next.

**Images:** fixed aspect ratios by context (product card `1:1`, hero banner `21:9` or `16:9`, vendor logo `1:1`) to prevent layout shift while loading. Use `next/image` for automatic optimization and sizing, pointed at the Supabase Storage public URL and its transformation query parameters (§9.9) rather than an unoptimized `<img>`. Lazy-load anything below the fold. Alt text is always meaningful — never the filename, never omitted.

### 7.6 Accessibility (WCAG 2.1 AA, per-component)

Project-wide: keyboard navigation across every interactive surface, screen-reader support, ARIA compliance, color-contrast compliance (4.5:1 body text, 3:1 large text/UI components), color never the sole carrier of state (pair with icon and/or text), stable layout dimensions for cards/grids/toolbars during loading so nothing jumps.

Per component type: **buttons/links** — visible focus ring, minimum 44x44px touch target on mobile; **icon-only buttons** — always an `aria-label`; **forms** — programmatic label association, errors announced via `aria-describedby`/`aria-live`; **modals/sheets** — focus-trapped, labelled by their heading (`aria-labelledby`), `Escape` closes, focus returns to the trigger; **images** — meaningful alt text (§7.5); **data tables** (admin/vendor dashboards) — proper `<th scope>` usage, not styled `<div>` grids pretending to be tables.

### 7.7 Page-by-page build spec

Build against `03_UI_UX_DESIGN_SYSTEM.md`'s full feature inventory, with the states in §7.5 applied to every listing/data view below (loading skeleton, empty state, error+retry) — that requirement isn't repeated per page below to avoid redundancy, but it applies to all of them without exception.

**Navigation and search:** search bar with autosuggest, voice-search icon, visual-search icon (camera/upload → "find products like this," §9.7), filters and sort. Mobile: bottom navigation (home, categories, search with the visual-search camera button, cart, account) with sticky add-to-cart on product pages; desktop: full top navigation with mega-menu for categories.

**Homepage:** announcement bar, hero slider, featured categories, category grid, flash sale (with countdown), featured products, trending products, best sellers, new arrivals, top rated, recommended products (AI recommendation engine, §1.0), featured vendors, popular brands, customer reviews (with video reviews), Instagram feed, blog articles, newsletter signup, trust badges, footer. Grid responsiveness per §7.3's product-grid rule (2/3/4/5 columns).

**Product listing (category/search/brand/vendor-store pages):** product grid (§7.3 columns), filter sidebar (desktop) / filter sheet (mobile, per §7.5's drawer pattern), sort control, pagination or infinite scroll (pick one project-wide, do not mix), active-filter chips with individual remove, result count, empty-result state with "clear filters" action.

**Product detail page:** image gallery with zoom, 360-degree viewer where available, product videos, lifestyle images, variant selector (color/size/etc. — reflecting the underlying `ProductVariants` model, §8.1), shipping and delivery-estimate display (sourced from the structured shipping data in §9.6.1, not hardcoded copy), add-to-cart, buy-now, wishlist toggle, compare toggle, share, reviews section with photo/video reviews, Q&A section, related products, vendor information block linking to the vendor store page. `schema.org` `Product`/`Offer` structured data (§9.6.1) on every instance of this template.

**Cart and checkout:** cart drawer/page with per-vendor grouping in the line-item display (reflecting §8.1's `OrderItems.vendorId` grouping) while still presenting one combined total; checkout as a single-column stepped flow on mobile, two-column (form + order summary) on desktop; address, shipping method, payment step, review step; one-click checkout entry point where a saved payment method exists; order confirmation screen with tracking entry point.

**Account (customer):** profile, addresses, order history (list → detail, showing per-vendor shipment status per §8.1's model, still under one Order), wishlist, reviews written, reward points balance and history, saved payment methods, support tickets.

**Vendor portal:** store profile, product management (list/create/edit/submit/archive, §9.4), inventory (§8.5), order management (scoped to that vendor's `Shipments`), shipping management, marketing tools, store analytics, customer engagement tools, staff accounts, payout management (including the escrow view added in §0.3 Fault 3 -- `/vendor/payouts/escrow`), and the full Social Media Automation UI specified in `03_UI_UX_DESIGN_SYSTEM.md`: connected-accounts grid (per-platform cards), connect/disconnect (OAuth), automation toggle (off by default, per platform), plan-gate banner tied to the entitlement model (§1.2.2, not a hardcoded tier check in the component), trigger-event selector, posting-schedule calendar, approval queue (post-by-post, matching the approval state machine in §9.8.4), AI caption preview card (editable before publish — never auto-published without this step being shown when approval is required), tone/style presets, frequency-cap and blackout-hours controls, excluded products/categories list, social performance dashboard, audit/history log, and the Store-Channel opt-in card (opt-in toggle, tag-my-handle toggle, excluded-products list, read-only "Featured by [Store]" performance).

**Admin portal:** vendor management (including approval workflow, §9.5.1), customer management, product management (approval queue, §9.5.1), order management, finance management (including the escrow/payout admin endpoints in §0.3 Fault 3), CMS management, marketing management, report management, settings management, RBAC management, audit logs, and the Store Social Channel UI: store-accounts panel, curation-weight sliders (trending/new/best-sellers/sponsored ratio), editorial calendar (approve/edit/reject, drag-to-reschedule), sponsored-slot booking manager, fairness-audit report, store-channel performance dashboard.

**CMS-rendered pages:** pages, blog (list/post), FAQs, banners -- rendered from CMS content (§9.5's CMS module), not hardcoded page bodies, so marketing can update them without a deploy.

**Standard content pages:** about, careers, contact, help center, support center, FAQ, privacy policy, terms & conditions, shipping/return/refund policy, matching the site hierarchy in `01_PROJECT_MASTER_SPECIFICATION.md` §5.

### 7.8 Adding a page

1. Identify whether the route is public, customer-protected, vendor-protected, or admin-protected.
2. Read the owning API controller/service and shared DTOs.
3. Add the route under root `app/`, following the routing conventions established by the current application.
4. Keep data loading on the server when possible; client components only for interactive islands.
5. Implement loading (skeleton), error (retry), empty, unauthorized, and not-found states per §7.5.
6. Use the tokens, scales, and components from §7.2–§7.4 — no ad hoc colors, spacing, or one-off component patterns.
7. Add metadata and structured data (`schema.org` `Product`/`Offer` for commerce pages -- §9.6) where the page represents indexable commerce content.
8. Check desktop and mobile layout against the breakpoints in §7.3, keyboard operation, and API failure behavior.
9. Build the web application before considering the change complete.

### 7.9 UI/UX definition of done

A screen is not complete merely because the happy path renders. It is complete only when: it uses the binding tokens and scales (§7.2-§7.3), not invented values; every interactive element implements the full state set in §7.5; loading/empty/error states exist for every data-driven view; the accessibility requirements in §7.6 are met for every component type present; the layout is verified at `sm`, `md`, `lg`, and `xl` breakpoints, not just desktop; dark mode is verified, not assumed to "just work" from the light-mode styles; and -- where applicable -- the page matches the §7.7 build spec for that page type rather than a simplified stand-in.

### 7.10 Authentication boundary

The browser may hide or redirect protected views for usability, but the API remains the authority. Every mutation must succeed or fail based on API authentication, RBAC permission, and entitlement checks -- not on the presence of a UI control.

---

## 8. Database development (Supabase)

### 8.1 Schema ownership

The current persisted catalog contract is `packages/database/prisma/schema.prisma`.
It defines seven models: `Vendor`, `Category`, `Brand`, `Product`,
`ProductApproval`, `ProductVariant`, and `ProductImage`. IDs use the schema's
UUID v7 database default. The current schema is only a catalog foundation; it
does not include the broader model inventory below. Supabase-hosted PostgreSQL
is the target managed database, but this handbook has not verified migration
application to a remote project. The `pgvector` extension is not part of the
current catalog implementation.

The broader domain inventory is a **target architecture** in
`02_DATABASE_ARCHITECTURE.md`; confirm every model exists in the schema and
migrations before using or claiming it. The domains include authentication,
customer, vendor, social automation, visual search, agent commerce, catalog,
inventory, orders, payments, marketing, CMS, notifications, support, analytics,
and audit.

Two domain-modeling decisions carry direct architectural weight and are binding:

- **Orders (§0.3 Fault 2 resolution):** one buyer-facing `Order`. A vendor "sub-order" is **not** a separate table — it is `OrderItems` grouped by `vendorId`, with exactly one `Shipment` per `(Order, vendor)` pair (`Shipments.vendorId` required and indexed). `OrderStatusHistory` records vendor-controllable states (packed, shipped, delivered) against the `Shipment`, and buyer-facing states (placed, paid, cancelled, completed) against the `Order`. Never expose per-vendor order fragmentation to the customer-facing API or UI (§1.0.2); vendor-facing views filter down to that vendor's `Shipment`/`OrderItems` instead.
- **Payments/payouts:** `Payments`, `Transactions`, `VendorPayouts`, and `EscrowHoldings` are system-of-record for commission math and payout holds, built against the recommended default flow in §0.2 (ATVOO as merchant of record, escrow held until delivery confirmation + return window, weekly payout batches). The schema and API are build-ready now; only the production release-of-funds job stays behind a flag pending finance/legal sign-off (§0.2).

#### 8.1.1 Social automation model (binding — supersedes the original module list, §0.3 Fault 1)

`06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` §27 explicitly revises the original `02_DATABASE_ARCHITECTURE.md` social-automation table list as insufficient, and `02` was never updated to match — this handbook is the authoritative reconciliation (§0.3). Build against the revised list:

```text
SocialCampaigns · SocialCampaignTargets
SocialPosts (authoritative content object)
SocialPostTargets (one post delivered to one destination)
SocialPostVariants
SocialPostDeliveryAttempts (full delivery history, never overwritten)
SocialPostAssets · SocialPostAnalytics
SocialAutomationRules · SocialAutomationTriggers
SocialPlatformWebhookEvents (append-only, unique on (platform, external_event_id))
SocialContentModerationLogs
SocialRateLimitEvents
SocialWorkflowRuns (n8n execution reference, workflow_version, never stores secrets)
SocialContentUsage
PlatformCapability (per-platform capability registry, §9.8.1)
```

`SocialPostQueue` from the original list may remain as an operational projection but must not be the sole source of social-post truth — `SocialPosts`/`SocialPostTargets` are authoritative. See §9.8 for the full workflow this model supports.

### 8.2 Current migration workflow

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npm run db:test
```

The root package currently provides no `db:migrate` authoring or
`db:migrate:status` script. Use the installed Prisma CLI with the schema path
when creating a migration, and never edit an applied migration. Validate
configuration and review the destination before deploying. For the catalog,
Prisma migrations and corresponding SQL under `supabase/migrations/` must stay
aligned. The raw Supabase SQL was tested against the same disposable local
PostgreSQL 17 database; that local verification does not prove remote
application.

For an explicitly selected remote development project, review the migration
diff and apply the Prisma migration and matching SQL using their respective
tools. `supabase db push` is not a root npm script and may act on the currently
linked project; verify the link before running it. Current migrations do not
provision Storage buckets.

For destructive or high-volume changes: verified restorable backup first, backfill separated from schema enforcement, compatible application code deployed before removing old columns/enum values, lock time and table size measured, rollback/forward-fix plan documented.

### 8.3 Prisma client, connections, and pooling

- For Supabase deployments, **runtime queries** should use `DATABASE_URL` (typically the transaction pooler, port `6543`).
- **CLI/migration operations** use `DIRECT_URL` (session pooler or direct connection); avoid running Prisma migrations through a transaction pooler.
- Use transactions for multi-record commerce mutations: order creation, stock reservation, payment state changes, commissions, returns, and the outbox-write-plus-state-change pattern in §9.8.2.
- Always apply tenant/ownership conditions in the query. Soft-deleted records excluded from normal reads. Explicit select/include shapes to avoid leaking sensitive fields or unbounded joins.

### 8.4 Seeds and local reset

There is no current seed script or reset command. The initial catalog
migration inserts reference categories and the `Unbranded` reference brand;
it does not create demo users, vendors, or products. Avoid reset commands
unless the exact target database is disposable and independently verified.

### 8.5 Inventory and warehouse model (target requirement)

The warehouse/inventory model and `/vendor/inventory` UI/API routes below are
target requirements. No inventory tables, vendor inventory routes, or checkout
integration currently exist.

The proposed model uses warehouse-level balances and inventory transactions;
multi-warehouse allocation, reservations, and low-stock alerts remain target
work and are not implemented.

### 8.6 Row Level Security policy (target requirement; current catalog scope only)

The current catalog migrations enable default-deny RLS for the catalog tables.
This is not an audit or guarantee for future tables. Review the SQL migrations
whenever a table is added; do not claim RLS coverage for the full target model
until every implemented table and access path has been checked.

Target requirement: every application table has RLS enabled with a **default-deny** policy set:

```sql
alter table public."<Table>" enable row level security;
-- no policies added = no access via anon/authenticated roles through PostgREST.
```

Do not assume the API connection bypasses RLS or that absent tables have
policies. For each future table, add and verify the appropriate policy in the
same change. A future CI workflow should check this contract; there is no
current CI workflow.

If a future revision deliberately adopts Supabase Auth or client-side `supabase-js` access for a specific surface, that surface gets real, scoped RLS policies at that time — an explicit architectural decision, not a default.

---

## 9. Business workflows (target behavior)

This section specifies intended workflows; it is not a feature inventory.
Unless explicitly marked as current, its routes, screens, modules, and
integrations are not implemented. The current public catalog API is listed in
§5.3, and §10 is the verified feature-status matrix.

### 9.1 Authentication and authorization

1. A user registers or signs in through the web client.
2. The API validates input, verifies credentials/provider identity, and creates session/refresh state.
3. Access requests carry the access token and pass the global JWT guard.
4. Permission-protected operations pass the RBAC guard (§1.2.1); entitlement-gated operations additionally pass the entitlement guard (§1.2.2); both apply ownership checks.
5. Refresh and logout invalidate or rotate the appropriate token/session state.

Failure cases: duplicate email, invalid credentials, inactive/deleted user, expired token, missing permission, missing entitlement, and cross-vendor access. Do not return password hashes, refresh secrets, or provider tokens. Password reset/verification requires a configured transactional email provider (§0.1, §4.1) — do not ship this flow silently no-op'd.

### 9.2 Product discovery and search

Catalog data loads through the NestJS API; current public API results exclude
unpublished/inactive records and apply availability/visibility rules. Search
uses PostgreSQL full-text and trigram indexes. Search/filter parameters are
bounded to prevent expensive unindexed queries. The server-rendered storefront
supports product search, category/brand/price/availability filters, sorting,
and pagination; `/categories` and category detail pages expose catalog
discovery. Product pages include canonical metadata and `schema.org`
`Product`/`Offer` JSON-LD; listing pages include `CollectionPage`/`ItemList`
and breadcrumb data. The `robots.txt`, sitemap, and `/llms.txt` discovery
surfaces are implemented. The listings are rendered without client-side
JavaScript. Streamed `notFound()` responses may use HTTP 200 with `noindex`
under Next.js partial prerendering.

Product pages expose canonical metadata, images, price, variants, availability, vendor info, and `schema.org` `Product`/`Offer` structured data (§9.6). Product mutations belong to authorized vendor/admin services.

### 9.3 Guest cart and checkout

Guests use `X-Cart-Session`. Customers use authenticated ownership. Cart operations validate product/variant existence, availability, quantity limits, and vendor rules.

Order creation re-reads prices and inventory server-side, calculates totals and platform fees, reserves/decrements stock consistently, and is idempotent (§6.2) where retries are possible. The buyer sees **one Order**; vendor sub-orders are `OrderItems` grouped by `vendorId` with one `Shipment` each (§8.1, §0.3 Fault 2) — never a separate customer-facing entity. Payment status is never inferred from client input. Orders, shipments, refunds, and returns preserve an auditable status history. Captured payment is held in `EscrowHoldings` per vendor `Shipment` and released to `VendorPayouts` on delivery confirmation + return window elapsed, per the default flow in §0.2 — build against that flow now, but keep the production release-of-funds job behind a feature flag until finance/legal sign-off (§0.2).

### 9.4 Vendor operations

Vendor owner/staff routes verify vendor membership and permission (§1.2.1) on every request. Product publication validates required catalog data, media, pricing, inventory, and visibility flags. Vendor analytics are scoped to that vendor. Payout calculations are based on authoritative order/payment/refund state, not browser totals.

The create/list/edit/submit/archive lifecycle, `/vendor/products/[id]/edit`
screen, and `/api/v1/vendor/products/:id` routes are target requirements; no
vendor product UI or API routes currently exist.

### 9.5 Admin operations

Admin actions use the permission model (§1.2.1), input validation, audit logging, and confirmation for destructive/financial operations. Prefer soft deletion and reversible state changes. Super-admin emergency controls (`admin:emergency`) are explicit and observable.

#### 9.5.1 Product approval lifecycle

The current schema defines `Product.approvalStatus` using
`AUTO_APPROVED`/`PENDING_REVIEW`/`APPROVED`/`REJECTED` and records decisions
in `ProductApproval`. Vendor submission and admin review UI/API routes shown
here are target requirements and are not implemented. Public catalog visibility
is enforced by the current catalog query; this is not an authenticated
approval workflow.

### 9.6 AI-agent commerce (rewritten per `07_AI_AGENT_COMMERCE_READINESS.md`)

AI shopping agents query structured product data directly rather than browsing pages. Three protocols matter as of 2026, and are additive, not mutually exclusive:

| Protocol | Owner | Mechanism |
| --- | --- | --- |
| **UCP** (Universal Commerce Protocol) | Google, launched Jan 2026 with Shopify/Walmart/Target/Etsy | Open, intent-based manifest; serves Google AI Mode, Gemini, and Microsoft Copilot's UCP path |
| **ACP** (Agentic Commerce Protocol) | OpenAI | Powers ChatGPT's Instant Checkout, built on Stripe as the payment rail |
| **Perplexity Merchant Program** | Perplexity | Accepts Google-Shopping-format feeds; "Buy with Pro" checkout via PayPal/Venmo, merchant stays merchant-of-record |

**Strategy: fix product-data hygiene once, generate protocol-specific feeds from that single clean source**, rather than treating each AI surface as a separate integration project.

#### 9.6.1 What "discoverable" requires

- `schema.org` `Product`/`Offer` structured data on every public product page — the foundation, benefiting classic SEO, Google Shopping, and every AI agent simultaneously.
- A machine-readable manifest at `/.well-known/commerce-manifest.json` (UCP's equivalent of `robots.txt` for commerce agents) declaring store identity, categories, policies, and feed locations.
- `/llms.txt` at the domain root — plain-language guidance for AI crawlers about brand, catalog scope, and how to interpret ATVOO's data, separate from human SEO copy.
- Structured shipping data per product/vendor (`country:region:service:price:min_handling:max_handling:min_transit:max_transit`) — agents need this to answer "can I get it by Friday" without parsing a policy page.
- Per-product `is_eligible_search` and `is_eligible_checkout` flags, so a vendor/admin can include a product in agent discovery while excluding it from autonomous checkout (regulated categories, made-to-order items, anything needing human judgment).

#### 9.6.2 Feed architecture

A single internal **Product Data Layer** (canonical, always current from Products/ProductVariants/Inventory) feeds three exporters: UCP → `/feeds/ucp` + manifest; ACP → `/feeds/acp` (Stripe-compatible fields); Perplexity/Google-Shopping-format → `/feeds/perplexity`. Feeds refresh near-real-time for price/availability (stale data is worse than no listing — agents penalize merchants flagged as inaccurate) and are validated for required-field completeness before publishing (missing GTIN, broken image URLs, and price/currency mismatches are the most common rejection causes).

#### 9.6.3 Checkout path (two tiers, vendor/admin configurable per product)

- **Discovery only** (`is_eligible_search: true`, `is_eligible_checkout: false`) — agent links back to the ATVOO product page for normal checkout. Lowest effort, safest starting point.
- **Agentic checkout** (`is_eligible_checkout: true`) — agent completes the purchase in-platform via ACP/Stripe or Perplexity's PayPal/Venmo rail. Requires seller ToS/Privacy Policy URLs in the feed. Settles against the same merchant-of-record/escrow flow as normal checkout (§0.2) — ATVOO captures and holds the payment, so no separate payment-rail ownership decision is needed once §0.2 is signed off.

**Recommended rollout:** discovery-only across the whole catalog first, then enable agentic checkout selectively once order attribution and fraud/dispute handling for agent-originated orders (§9.6.5) are proven. Keep a platform-wide disable switch.

#### 9.6.4 MCP pilot (recommended low-risk first step)

Because Claude and other assistants increasingly connect to external tools via the Model Context Protocol, ATVOO can expose a lightweight MCP server offering `search_products`, `get_product_details`, and `check_availability` tools — a smaller lift than a full ACP/UCP integration, and a natural fit given the assistant used to build this platform. Worth piloting before committing to the heavier protocols.

#### 9.6.5 Attribution, analytics, and trust

Every order gets an `AgentOrderAttribution` record (which agent/protocol sourced it: ChatGPT, Perplexity, Gemini, organic, none) — without this, agentic checkout looks like a normal direct order with no referrer. Admin dashboard tracks agent impression share, recommendation-inclusion rate, and agent-attributed conversion rate on 30/60/90-day windows. Fraud/dispute handling must explicitly cover agent-originated orders — return abuse and payment disputes behave differently when the "customer" was an autonomous agent.

#### 9.6.6 Compliance

Some large retailers have blocked AI crawlers or sued over unauthorized agent purchases — a live, contested space. Keep agent eligibility an explicit opt-in at the vendor/product level, never silently on for the whole catalog, and keep an admin-level kill switch to disable agentic checkout platform-wide if a protocol partner's terms or behavior become a liability.

### 9.7 Visual search (`pgvector`)

Flow: customer taps the camera icon (search bar, mobile or desktop) → uploads/takes a photo → Visual Search Service generates an embedding via a vision model → compared against `ProductImageEmbeddings` (`pgvector`, cosine similarity) → top-N ranked, filterable by category/price/vendor like normal results → query and results logged to `VisualSearchQueries`/`VisualSearchResults` for relevance tuning and gap detection. `pgvector` is native to Supabase (enabled in §3.2), removing the need for a separate vector database.

Every product image gets an embedding generated at upload time (background job, not blocking the vendor's upload flow) and regenerated if the image is replaced; multiple images per product each get an embedding, and matching uses the best-scoring image, not just the primary one. Target: **under 2 seconds end-to-end** (§1.0.1). Graceful degradation: below the similarity threshold, fall back to the closest category match plus a prompt to refine with text, never an empty result. Confirm which embedding provider, index type (`ivfflat` vs. `hnsw`), and similarity threshold are actually configured before claiming this flow is complete.

### 9.8 Social media automation engine (SMAE)

Full detail lives in `06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md` (1,500+ lines) — this section is the operational summary a developer needs before touching code, not a replacement for reading it.

**Core rule:** ATVOO owns business truth. n8n orchestrates work. Social platforms own final publication and provider metrics.

Two separate operating modes:

- **Mode A — Vendor channel:** a vendor explicitly connects its own social destinations and opts in. Never silent, implicit, or opt-out.
- **Mode B — Store channel:** ATVOO promotes selected vendors, products, campaigns, categories, and editorial content from marketplace-owned accounts. Vendor authorization for Mode A never implies permission for ATVOO to use that vendor's account outside the configured Mode B opt-in scope.

#### 9.8.1 Channel and capability model

Do not model every platform as a generic `SocialAccount` with identical behavior. Every destination carries `platform`, `account_type`, `authorization_status`, `token_status`, `platform_account_id`, `destination_id`, `capabilities`, `scopes`, `timezone`, `locale`, `last_validated_at`. Maintain a `PlatformCapability` registry (per platform: supported capability, required scopes, business-account/provider-approval requirements, supported media types, max text length, scheduling/edit/delete/webhook/analytics support, provider API version, last verified date) rather than hard-coding platform assumptions — a platform adapter must refuse unsupported operations before a job reaches publication. **WhatsApp Business Catalog is not an ordinary post destination** — model it as `CATALOG_SYNC`, never conflated with organic social publishing.

#### 9.8.2 Outbox, event contract, and idempotency

Product/vendor state changes that trigger social events use a **transactional outbox pattern**: the DB transaction that updates the product also writes an outbox event, which a dispatcher delivers to n8n — this prevents a product from becoming published while the corresponding social event is silently lost. Retries reuse the same `event_id`.

Every event carries `event_id`, `event_type`, `schema_version`, `occurred_at`, `vendor_id`, `correlation_id`, `source`, and `payload`. `event_id` is immutable and reused across retries; duplicate delivery returns/reuses the existing result rather than creating another social post. The event payload is never treated as authoritative — re-fetch product/price/stock facts through the ATVOO API before generating or publishing content (§9.8.4, "product change revalidation").

#### 9.8.3 n8n's role and workflow families

n8n handles orchestration: receiving events, calling ATVOO APIs, AI generation, transformations, workflow routing, provider integration, notifications, retries, scheduled analytics sync. ATVOO remains responsible for vendor ownership, permissions, subscription entitlements, product truth, social account state, automation rules, post state, approval, audit, and attribution. **If n8n is deleted, recreated, or replaced, business state must remain intact** — this is why every workflow is exported to `workflows/n8n/` (§2) and versioned.

Preferred data path: `n8n → ATVOO API → Supabase PostgreSQL`. Never `n8n → arbitrary SQL → production tables`; a restricted read-only analytics connection may be approved separately, but business mutations always go through documented APIs.

Recommended workflow families (build as separate workflows, not one giant one): **WF-01** Product Event Intake (webhook → signature validation → idempotency → acknowledge → queue), **WF-02** Eligibility (vendor/product/rules/subscription/capability/frequency checks), **WF-03** AI Generation (canonical facts → platform-specific generation → schema validation), **WF-04** Moderation, **WF-05** Approval, **WF-06** Scheduler (timezone/blackout/best-time/frequency → delivery job), **WF-07** Publisher (final validation → provider → status capture), **WF-08** Provider Status (webhook/poll → verify → idempotency → update ATVOO), **WF-09** Analytics (normalize → snapshot → attribution), **WF-10** Failure Recovery (classify → retry → reconcile → DLQ → notify).

#### 9.8.4 Content pipeline: generation, moderation, approval

AI receives only structured, validated facts (product name, brand, category, approved features, price, currency, discount, availability, vendor name, product URL, approved claims, tone, platform, objective, CTA, language, locale) and returns schema-validated JSON (`caption`, `hashtags`, `cta`, `asset_id`, `destination_url`, `disclosures`, `variant`). **AI must never invent** price, discount, specifications, certifications, medical claims, delivery promises, guarantees, stock quantities, reviews/testimonials, or URLs. Product descriptions are untrusted input and must not override system instructions.

Pipeline: canonical facts → content strategy → platform-specific generation (never one universal caption blindly copied everywhere) → schema validation → moderation → approval → scheduling → publication. Moderation checks product truth (name, price, discount, stock, URL, factual claims), brand/policy (banned terms, restricted categories, deceptive/unsafe claims, vendor and platform rules), and technical validity (text limits, media, URL, CTA, required disclosures), producing `PASSED`, `PASSED_WITH_WARNINGS`, `REQUIRES_HUMAN_REVIEW`, or `BLOCKED`.

Post state machine: `DRAFT → MODERATION_PENDING → APPROVAL_REQUIRED → APPROVED → SCHEDULED → READY_TO_PUBLISH → PUBLISHING → SUBMITTED → PROCESSING → PUBLISHED`, with failure branches to `REJECTED`, `BLOCKED`, `RETRY_PENDING`, `REQUIRES_REAUTH`, and `FAILED`. Invalid state transitions must be rejected by the API. **Even with auto-publish enabled, run a final pre-publish gate** immediately before publication re-checking subscription, connection, authorization, rule, vendor, product eligibility, price, stock, campaign, approval, frequency cap, blackout window, duplicate detection, platform capability, asset validity, and moderation — if any mandatory check fails, cancel/regenerate/reschedule/route to review, never publish anyway.

#### 9.8.5 Assets, scheduling, frequency

Only approved ATVOO media may be published, considering ownership/licensing, platform dimensions, aspect ratio, resolution, file type/size, relevance, prior performance, and campaign rules. **Durable object storage only** (`SUPABASE_STORAGE_BUCKET_SOCIAL_ASSETS`) — never local filesystem paths or ephemeral n8n files. Provider-specific media transformations happen before publishing.

Scheduling strategies: `IMMEDIATE`, `FIXED_TIME`, `BEST_TIME`, `NEXT_ALLOWED_WINDOW`, `MANUAL`. All timestamps stored in UTC; vendor timezone is the default for vendor-owned automation. Frequency/cooldown controls exist at multiple levels simultaneously (vendor/day, vendor/platform/day, destination/day, product cooldown, category cooldown, campaign, identical-content hash, near-duplicate content) and must be atomic enough to prevent concurrent workers from both passing the same limit.

#### 9.8.6 Campaigns, attribution, and analytics

`SocialCampaigns` is a first-class entity (objective, target products/categories/platforms, frequency/approval policy, status) — a trigger answers *why* the workflow started, an objective answers *what the content is trying to achieve*. Generated marketplace URLs carry UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_social_post`, `utm_vendor`) — never secrets or personal data in tracking parameters. Attribution distinguishes click → product view → cart → checkout → order → revenue; where provider data can't be joined reliably, report the limitation rather than fabricate attribution.

Metrics distinguish provider metrics from normalized/attributed metrics; a missing provider metric is `null`, never zero. Use periodic snapshots (1h/6h/24h/7d/28d windows) since provider metrics change over time.

#### 9.8.7 Platform-specific rules and implementation order

**Build Meta (Facebook/Instagram) first** — current official Meta APIs, validating account type, page/business relationship, publishing permission, media requirements, API version, review requirements, and analytics permissions at implementation time. Then Pinterest (board/section destination modeling, scoped OAuth), TikTok (official Content Posting API, provider-specific scopes/approval, asynchronous status, AI-content disclosure rules), X (verify actual API access level/rate limits/publishing permissions for the real developer account — do not assume one universal capability set), and finally Google Business Profile (business/location channel, not a generic network) and WhatsApp Business Catalog (`CATALOG_SYNC`). Re-verify provider-specific capabilities whenever an adapter is implemented or upgraded — provider documentation is authoritative for provider behavior.

Phased build order per `06` §51:

```text
Phase 1 — Foundation: VendorSocialAccounts, OAuth connect/disconnect, entitlement checks,
          SocialPosts/SocialPostTargets, platform adapter contract, manual Share to Social,
          first Meta adapter, basic analytics
Phase 2 — Automation: transactional outbox, n8n event intake, automation rules, AI generation,
          moderation, approval queue, scheduler, retry/DLQ, idempotency/reconciliation
Phase 3 — More platforms: Pinterest, X, TikTok, provider webhooks, platform-specific media
Phase 4 — Intelligence: campaigns, best-time recommendations, A/B testing, advanced analytics,
          marketplace-owned automation
Phase 5 — Commerce channels: WhatsApp catalog sync, Google Business Profile, additional platforms
```

#### 9.8.8 Prohibited behavior (binding — implementation MUST NOT)

Publish without explicit authorization; bypass subscription entitlement or vendor isolation; expose OAuth tokens to the frontend or send them to AI providers; allow n8n arbitrary production-table mutation; trust frontend subscription values or AI-generated commercial facts; publish stale prices or known-out-of-stock products as available; retry non-retryable failures indefinitely; create duplicate posts from duplicate events; assume all platforms support identical content; automatically spam arbitrary groups/communities; use undocumented/private platform APIs; use development social credentials in production; store secrets in n8n execution data; treat API submission as proof of final publication; delete required audit/financial records merely because a vendor requests deletion; let product text override system/policy instructions.

#### 9.8.9 Definition of done (social automation feature)

Not complete merely because a post can be created. Complete only when OAuth works, scopes are verified, tokens are secure, destination discovery works, content validation works, moderation works, approval works where required, scheduling works, duplicate protection works, rate limits work, retries work, provider status is reconciled, webhook/polling handling works, analytics work where available, disconnect works, vendor isolation works, audit works, the n8n workflow is versioned (in `workflows/n8n/`), the error workflow is tested, production credentials are isolated, provider policy requirements are documented, and automated tests pass.

### 9.9 Image upload and storage (Supabase Storage)

Target behavior (not implemented): authenticated vendor product-image uploads
at `POST /api/v1/uploads/product/:productId`, multipart field `file`, JPEG /
PNG / WebP / GIF up to 5 MB. The current API does not expose an upload route.

1. API verifies vendor ownership of the product.
2. API uploads to `SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` using the service-role Storage client, path keyed by vendor and product ID.
3. Bucket is **public-read**, **no anonymous write** — all writes go through the API's service-role key, never a client-issued signed upload URL, unless a later revision explicitly adopts direct-to-storage uploads.
4. On success, the existing primary image is demoted and the new image becomes primary in the same transaction that records the Storage object path.
5. Product image URLs served to the storefront are the bucket's public URL; do not hardcode a different CDN path.

Social-post media assets use the separate `SUPABASE_STORAGE_BUCKET_SOCIAL_ASSETS` bucket (§9.8.5) — never local disk or ephemeral n8n files, per `06` §15. Image resizing/optimization can use Supabase Storage's built-in transformation API. Malware scanning on upload remains **Planned/prerequisite** (§10) and must be resolved before accepting uploads from untrusted vendors at scale.

---

## 10. Feature status

| Capability | Status | Verified evidence / limit |
| --- | --- | --- |
| Next.js storefront | Phase 2 complete | Server-rendered product listing/search/filter/pagination, product detail, category index/detail, metadata/JSON-LD, `robots.txt`, `sitemap.xml`, and `/llms.txt`; portal and commerce routes remain unimplemented. |
| NestJS catalog API and Swagger | Implemented slice | `apps/api/src/`; public product list/search/detail, categories, and brands only. |
| Catalog schema and migrations | Implemented foundation | `packages/database/prisma/` and aligned `supabase/migrations/`; not the full domain model in `02`. |
| Public catalog visibility/search | Implemented slice | Catalog service enforces publication criteria; PostgreSQL full-text/trigram search migrations are present. |
| Catalog RLS | Implemented for initial catalog tables | Default-deny policies are in the catalog migration set; no claim is made for future or absent tables. |
| API input validation, errors, request IDs, CORS | Implemented | Configured in `apps/api/src/main.ts`; CORS is limited to explicitly configured origins and disabled when none are configured. |
| Storefront catalog integration and discovery | Implemented; Phase 2 gate passed | `app/` server-renders API-backed catalog pages; `npm run test:storefront` verifies no-JS HTML, filters, metadata/JSON-LD, crawler surfaces, not-found behavior, and selected accessibility checks. This is not automated browser accessibility certification. |
| Supabase hosted database application | Unverified / not applied in this work | Only disposable local PostgreSQL 17 validation was performed. |
| Supabase Storage provisioning/uploads | Not implemented | API forms public media URLs; no bucket bootstrap or upload handler. |
| Authentication, RBAC, entitlements, accounts | Not implemented | Targeted in the architecture/specifications only. |
| Cart, checkout, orders, payments, escrow, payouts | Not implemented | No current schema/API implementation. |
| Vendor/admin portals, CMS, reviews, loyalty, affiliates, returns | Not implemented | Target requirements only. |
| Redis, outbox, n8n, social automation, visual search/pgvector | Not implemented | Target requirements only. |
| CI/CD and production deployment | Not configured / unverified | No checked-in GitHub Actions workflows or API Dockerfile/deployment file. |
| Test/build coverage | Partial | API and migration contract tests exist; no full-platform or coverage-threshold claim. |

The list above is the implementation snapshot, not a release sign-off. Update
it only after verifying the source and the relevant behavior.

---

## 11. Security and compliance

### 11.1 Baseline controls

These are target security requirements, not a statement that the current
catalog API implements every control. Current API controls are limited to the
validation, CORS, request-ID, and structured-error behavior documented in
§5.2. Verify each control in code before treating it as enforced.

- Hash passwords with the approved password hashing implementation; separate strong JWT access/refresh secrets; rotate/revoke after suspicious activity.
- Validate and whitelist request data with the global validation pipe; enforce CORS to known origins, no wildcard credentials; keep throttling enabled at §6.2 defaults.
- Enforce the RBAC permission model (§1.2.1) **and** the entitlement model (§1.2.2) — checking only one is an incomplete authorization implementation for any social/premium feature.
- Enforce RLS default-deny on every table, including SMAE tables, as a second independent layer (§8.6).
- Encrypt OAuth tokens at rest (`SOCIAL_ENCRYPTION_KEY`) and support immediate disconnect/revocation — on disconnect, stop using the credential immediately and disable publishing (actual provider-side revocation timing depends on the provider).
- Verify webhook signatures (HMAC + timestamp + nonce + event ID, §6.2) and reject replayed/duplicate events using the idempotency mechanism.
- Restrict upload type, size, content, and storage destination; all uploads go through Supabase Storage via the service-role client, never local disk, never ephemeral n8n files (§9.9, §9.8.5).
- Treat `SUPABASE_SERVICE_ROLE_KEY` and `N8N_SERVICE_API_KEY` as top-tier secrets: never in client bundles or n8n execution data, never logged, rotated on any suspected exposure.
- n8n execution data must never contain OAuth access/refresh tokens or unnecessary PII (`06` §38). n8n uses a narrowly scoped, rotatable service credential to call ATVOO — never a broad production database credential (`06` §39).
- AI-generated commercial facts (price, discount, specs, claims, stock) are never trusted without revalidation against authoritative ATVOO data, in social captions and anywhere else AI touches the platform (§1.1, §9.8.4).
- Redact authorization headers, passwords, tokens, payment data, service-role/service-API keys, and sensitive PII from logs.
- Record audit events for administrative, financial, permission, integration, and content-publication actions, including the SMAE audit event set (§9.8's referenced `06` §45: `SOCIAL_ACCOUNT_CONNECTED/DISCONNECTED`, `AUTOMATION_ENABLED/DISABLED`, `RULE_CREATED/UPDATED`, `POST_GENERATED/MODERATED/APPROVED/REJECTED/SCHEDULED/CANCELLED/SUBMITTED/PUBLISHED/FAILED`, `TOKEN_REFRESHED/EXPIRED`, `WEBHOOK_RECEIVED`, `ANALYTICS_SYNCED`), each with actor, vendor/owner, entity, action, timestamp, correlation ID, request ID, and result.

### 11.2 Production blockers to resolve

- Confirm RLS default-deny policies exist for every table, including the full revised SMAE model (§8.1.1).
- Confirm Supabase Storage buckets are correctly scoped (public-read for product/social media, private for any future document uploads).
- Complete payment provider, webhook, reconciliation, refund, and dispute handling — including agent-originated order disputes (§9.6.5).
- Complete social provider approval, token lifecycle, moderation, rate limiting, and n8n queue/DLQ operations, in the phased order of §9.8.7.
- Validate AI protocol terms, feed schemas, consent/eligibility, and kill switches for both AI-agent commerce (§9.6.6) and social automation (§9.8.8).
- Implement malware scanning on vendor uploads.
- Build the escrow/payout schema and API against the default flow in §0.2; keep the release-of-funds job behind a flag until finance/legal sign-off is obtained — do not enable real vendor payouts before that sign-off exists.
- Define retention, deletion, export, and incident response policies for customer, vendor, and connected-social-account data — including the SMAE rule that required audit/financial records are not deleted merely because a vendor requests deletion (§9.8.8).
- Confirm Supabase project plan tier provides the backup/PITR coverage assumed in §13.4.

### 11.3 Incident actions

**Leaked secret (including Supabase service-role key or n8n service credential):** rotate immediately in its origin system, invalidate dependent sessions, inspect logs/provider/Supabase/n8n activity, remove from repository history through the approved process, record impact.

**OAuth compromise (social platform):** disconnect the provider account, revoke tokens at the provider, rotate `SOCIAL_ENCRYPTION_KEY` if necessary, notify the vendor, inspect automation history via `SocialWorkflowRuns`/audit events.

**Payment inconsistency:** stop repeated retries, reconcile provider and local transaction state, preserve the audit trail, never manually mark paid orders without finance approval.

**Webhook replay or abuse (social or payment):** disable the endpoint/integration temporarily, verify signatures and event IDs, inspect idempotency records, replay only trusted events.

**Database migration failure:** stop rollout, capture logs and migration state, restore from Supabase backup or forward-fix, validate data before reopening traffic.

**Unexpected PostgREST access (RLS gap discovered):** treat as a security incident — repair the missing default-deny policy immediately, audit access logs, confirm the anon key wasn't used to exfiltrate data before closing.

**n8n compromise or unexpected workflow behavior:** disable the affected workflow immediately (n8n activation toggle), rotate `N8N_SERVICE_API_KEY` and `N8N_WEBHOOK_SIGNING_SECRET`, inspect `SocialWorkflowRuns` and audit events for the affected window, confirm no OAuth tokens or PII were exposed in execution data before resuming.

---

## 12. Testing and quality

### 12.1 Required checks

```bash
npm run db:validate
npm run db:generate
npm run build
npm run build:api
npm run lint
npm run test:api
npm run test:storefront
npm run db:test
```

There is no configured CI workflow. Run the relevant commands locally for
each change and record any unverified production behavior as a gap. Never
claim the 80% target (`05_DEVELOPMENT_STANDARDS.md`) is met without coverage
output.

### 12.2 Test layers

- **Unit:** business rules, DTO behavior, calculators, guards, service edge cases; for SMAE specifically — entitlement checks, rule matching, frequency/cooldown logic, content validation, state-machine transitions, idempotency, URL/UTM generation.
- **Integration (target):** Prisma queries against disposable PostgreSQL/Supabase, RBAC/entitlement checks, transactions, Redis/queue adapters, provider boundaries; for SMAE — OAuth callback, token refresh, platform adapter calls, webhook signature verification, n8n API contract, database uniqueness constraints, outbox delivery.
- **API:** status codes, validation, auth, RBAC, entitlements, pagination, idempotency, the standard error envelope.
- **E2E:** registration, catalog browsing, cart, checkout, order tracking, vendor isolation, admin workflows, critical public pages; for SMAE — `product published → event → n8n → eligibility → AI → moderation → approval → schedule → provider → status → analytics`.
- **Frontend:** loading/error/empty states, forms, route protection, responsive behavior, accessibility, structured metadata.
- **Smoke (target):** Swagger, migration status, catalog routes, Storage bucket reachability, production build output. There is no health route, seed script, or public-feed endpoint in the current implementation.
- **Failure tests (SMAE, explicit per `06` §48):** duplicate events, duplicate workflows, duplicate publish after timeout, expired token, revoked permission, provider 429/5xx, invalid media, product deletion mid-flow, out-of-stock at publish time, price change mid-flow, subscription expiry mid-flow, n8n outage, duplicate webhook delivery, provider reconciliation mismatch.

### 12.3 Definition of done

A feature is not complete until its code, schema (including any required RLS policy), authorization (RBAC **and** entitlements where applicable), errors, tests, documentation, environment requirements, observability, and deployment implications are addressed. External integrations additionally require sandbox validation and a rollback/disable procedure. Social automation features specifically follow the definition of done in §9.8.9.

---

## 13. Deployment and operations

### 13.1 Current deployment status

No deployment provider/configuration is established in the current repository.
There is no `vercel.json`, API Dockerfile, Docker Compose file, or checked-in
GitHub Actions workflow. The Next.js app can be built with `npm run build`;
the API can be built with `npm run build:api`. Neither command proves that
either service is deployed. Hosted database migration and production
environment status remain unverified.

### 13.2 Deployment requirements when deployment is introduced

Choose and document a host for the root Next.js application and the NestJS API.
Configure the API's current required environment variables from `.env.example`
using the host's secret manager. Do not configure future JWT, Redis, n8n,
Storage-upload, payment, or OAuth values as though those features were active.
Keep storefront-to-API traffic on the API boundary; never expose database
credentials to the browser.

Before applying a migration, review the Prisma and matching Supabase SQL
diffs, verify the exact target project, and use a recoverable rollout plan.
Do not apply migrations to a shared or production project as part of local
development or documentation validation.

### 13.3 Release checklist (target procedure)

1. Run the root build, lint, API tests, schema validation, and migration-contract tests.
2. Review both migration histories and verify the target database/project.
3. Apply only reviewed migrations to the intended environment.
4. Deploy the API and web app using their actual package scripts and the selected host's documented process.
5. Smoke-test the homepage, `/api/docs`, and each implemented catalog route.
6. Verify request errors, CORS behavior, logs, and database connectivity without exposing secrets.
7. Keep rollback or forward-fix steps available before serving production traffic.

### 13.4 Backups and observability

Backups, restore drills, monitoring, CDN, Redis durability, and the
SMAE-specific metrics in `05`/`06` are requirements to establish before launch;
they are not configured or verified in this repository.

### 13.5 CI/CD

There is no checked-in CI/CD workflow. When adding one, use only existing
commands from §16.1 and keep deployment/migration steps gated on explicit
environment configuration and review. Do not document an example workflow as
active until it exists and has passed on the repository's branch.

---

## 14. Troubleshooting

### Prisma client cannot be found

```bash
npm run db:generate
```

Confirm dependencies are installed from the root lockfile, then regenerate the Prisma client.

### Migrations succeed locally but fail in CI/production

Review the Prisma migration connection (`DIRECT_URL`) and the destination linked in the Supabase CLI separately. There is no current CI migration job; never assume a deployment uses the intended project.

### API cannot connect to the database

Check that `DATABASE_URL` is valid for the configured PostgreSQL service, review migration status, and confirm the API loaded the intended `.env`. The API currently checks only that `DATABASE_URL` is present at startup.

### "Too many connections" under load

Confirm runtime queries use the **pooled** `DATABASE_URL`, not `DIRECT_URL`. Verify combined `connection_limit` across instances stays under the pooler's ceiling for the plan tier.

### Search is empty or slow

Confirm the `tsvector`/`GIN` index exists on searched columns. Elasticsearch is not part of the default path — don't debug an Elasticsearch connection that shouldn't exist.

### CORS errors

Set `CORS_ORIGIN` to the exact storefront origin(s), protocol included. Restart the API after changing environment variables.

### Product images don't appear

The current catalog API composes public bucket URLs but does not create buckets
or upload images. Verify the `SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` value and
manually provision the public bucket in the intended development project.

### Anon-key access to a table unexpectedly succeeds

The table's RLS default-deny policy is missing (§8.6). Treat as a security incident (§11.3).

### A social post published twice, or an event seems to have been processed more than once

Check `event_id` reuse across retries and the `(social_post_target_id)`/`(platform, external_event_id)` uniqueness constraints (§9.8.2, §8.1.1). This is an idempotency-mechanism bug, not a "just add a duplicate check in the UI" fix.

### n8n workflow fails silently or produces unexpected side effects

Check `SocialWorkflowRuns` for the execution reference and status; confirm the workflow version matches what's exported in `workflows/n8n/` (drift here means someone edited the workflow in the n8n UI without exporting — treat as a process violation, not just a bug).

---

## 15. Change checklists

### 15.1 Backend feature

- [ ] Read relevant specifications and identify current status.
- [ ] Identify module, models, required permission (§1.2.1), required entitlement if any (§1.2.2), and external dependencies.
- [ ] Add DTO validation and ownership checks.
- [ ] Add controller/service behavior behind a repository-pattern boundary (§6.1), following §6.2's contracts, with Swagger metadata.
- [ ] Add tests for invalid, unauthorized, missing-entitlement, duplicate, and retry paths.
- [ ] Add audit/logging/metrics for high-impact operations.
- [ ] Update shared types and frontend consumers if required.
- [ ] Update handbook status and environment requirements.

### 15.2 Frontend feature

- [ ] Identify route protection and data owner.
- [ ] Prefer server-side data loading and existing helpers.
- [ ] Implement the full component state set (§7.5): loading skeleton, error+retry, empty, disabled, success — not just the happy path.
- [ ] Use the binding design tokens and type/spacing/radius/elevation scales (§7.2–§7.3) and the shadcn/ui + Tailwind + lucide-react stack (§7.4) — no ad hoc colors, spacing, or a second component kit.
- [ ] Match the §7.7 page-by-page build spec for this page type, not a simplified stand-in.
- [ ] Verify accessibility per §7.6 for every component type on the page.
- [ ] Verify layout at `sm`/`md`/`lg`/`xl` (§7.3) and in dark mode — not desktop-light-mode only.
- [ ] Avoid exposing secrets or trusting client totals/permissions; confirm no `supabase-js` or Supabase key ever reaches the web app.
- [ ] Test API failure and mobile layouts.

### 15.3 Database feature

- [ ] Confirm the model belongs in the schema and has a clear owner (cross-check `02_DATABASE_ARCHITECTURE.md`, and `06` §27 if it's a social-automation model).
- [ ] Add migration; do not edit applied migrations. Use UUID v7 for identifiers.
- [ ] Add the matching RLS default-deny policy in `supabase/migrations/` in the same PR (§8.6).
- [ ] Plan nullability, backfill, indexes, retention, and rollback.
- [ ] Use transactions for coupled commerce mutations, including outbox writes (§9.8.2).
- [ ] Update seed data only for safe local/test fixtures (no application seed script currently exists).
- [ ] Run `npm run db:validate`, `npm run db:generate`, and database contract tests.
- [ ] Add/verify CI migration checks if a CI workflow is introduced; none exists currently.

### 15.4 External / SMAE integration

- [ ] Confirm provider terms, credentials, scopes, sandbox access, and current phase per §9.8.7 (don't build Phase 3 platforms before Phase 1–2 are solid).
- [ ] Register the platform in the `PlatformCapability` registry (§9.8.1) before any adapter code ships.
- [ ] Encrypt stored credentials and implement revocation; separate dev/staging/production credentials (§4.2).
- [ ] Verify webhook signatures (HMAC+timestamp+nonce) and idempotency (§6.2, §9.8.2).
- [ ] Add rate limits, retries (transient only — see §9.8's retry rules), timeouts, and failure isolation.
- [ ] Add observability metrics from §13.4's SMAE list and a kill switch.
- [ ] Export the n8n workflow to `workflows/n8n/` with a version bump; never edit production workflows only in the n8n UI.
- [ ] Document data retention and deletion behavior.
- [ ] Test provider failure and recovery, plus the SMAE failure-test list (§12.2).

### 15.5 Deployment

- [ ] Run a clean install and the applicable production builds.
- [ ] Validate environment variables and secret sources for the target Supabase project and n8n environment (§4.2).
- [ ] Apply migrations only through the target environment's reviewed deployment procedure; no CI migration job exists currently.
- [ ] Record the selected web/API host configuration; none is currently checked in.
- [ ] Run smoke checks for implemented routes; health, auth, checkout, and social automation are not current endpoints.
- [ ] Inspect logs, errors, queues, payments, webhooks, and feed freshness.

---

## 16. Reference

### 16.1 Root commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the root lockfile. |
| `npm run dev` | Start the root Next.js app. |
| `npm run dev:api` | Start the NestJS API workspace in development. |
| `npm run build` / `npm run build:api` | Build the Next.js app / API. |
| `npm run start` | Start the built Next.js app. |
| `npm run lint` | Run ESLint from the root. |
| `npm run test:api` / `npm run db:test` | Run API tests / database migration-contract tests. |
| `npm run test:storefront` | Run production storefront smoke checks for Phase 2 discovery and accessibility requirements. |
| `npm run db:validate` | Validate the Prisma schema. |
| `npm run db:generate` | Generate Prisma Client. |
| `npm run db:migrate:deploy` | Deploy existing Prisma migrations; verify the destination before use. |
| `supabase link --project-ref <ref>` | Supabase CLI command; link only the intended project. |
| `supabase db push` | Supabase CLI command; apply raw SQL to the currently linked project after verifying the link and changes. |

### 16.2 Specialist specifications

- [Project master specification](./01_PROJECT_MASTER_SPECIFICATION.md) — vision, modules, revenue, roles, NFRs, market-weakness mapping.
- [Database architecture](./02_DATABASE_ARCHITECTURE.md) — full model inventory; §8.1.1 above notes the SMAE-specific revision.
- [UI/UX design system](./03_UI_UX_DESIGN_SYSTEM.md) — binding design tokens, page-by-page component inventory.
- [API architecture](./04_API_ARCHITECTURE.md) — full endpoint inventory and API rules.
- [Development standards](./05_DEVELOPMENT_STANDARDS.md) — Clean Architecture/DDD/SOLID, testing/coverage target, DevOps stack, and the Cursor operating rule reproduced at the top of this handbook.
- [Social media automation engine](./06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md) — the SMAE master spec; §9.8 above is a summary, not a substitute.
- [AI agent commerce and visual search](./07_AI_AGENT_COMMERCE_READINESS.md) — UCP/ACP/Perplexity/MCP and visual search; §9.6–9.7 above are a summary.
- [Database setup pointer](./SETUP_DATABASE.md) — superseded by this handbook for setup and migration guidance.

### 16.3 Glossary

| Term | Meaning |
| --- | --- |
| API | NestJS service consumed by the storefront and integrations. |
| RBAC | Role-based access control, via the `Permission` enum (§1.2.1). |
| Entitlement | Subscription-plan-derived capability flag, checked separately from RBAC (§1.2.2). |
| RLS | Row Level Security — used here as default-deny defense-in-depth (§8.6). |
| Pooler (transaction/session) | Supabase's Supavisor pooler; transaction mode (6543) for app runtime, session mode (5432) for migrations. |
| UUID v7 | Time-ordered UUID variant used as the project's identifier strategy (`02`). |
| Outbox pattern | Transactional write of a domain change plus an event record in the same DB transaction, dispatched afterward — prevents lost events (§9.8.2). |
| n8n | Workflow orchestration engine; coordinates SMAE without owning business truth (§9.8.3). |
| DLQ | Dead-letter queue — storage for jobs that exhausted retry attempts. |
| UCP / ACP | Universal Commerce Protocol (Google) / Agentic Commerce Protocol (OpenAI/Stripe) — see §9.6. |
| MCP | Model Context Protocol — basis for the recommended low-risk agent-commerce pilot (§9.6.4). |
| Escrow | Held funds pending vendor payout release; business model open per §0.1. |
| Idempotency key | Client- or system-supplied identifier ensuring a repeated request/event does not create duplicate side effects. |

### 16.4 Known gaps to maintain

- n8n hosting, email provider, and Kubernetes timing are resolved defaults (§0.1) — build against them. The escrow/payout model (§0.2) is build-ready but its production release-of-funds job must stay behind a flag until finance/legal sign-off is obtained; track that sign-off as a release-blocking task, not an engineering one.
- The existing catalog migration set enables default-deny RLS for current catalog tables; review each future table independently. The target SMAE tables (§8.1.1) do not exist yet.
- No upload route or local-disk upload path is implemented. When storage uploads are added, keep them out of ephemeral local disk.
- UUID v7 is the current catalog ID strategy; preserve it when extending the schema.
- Build the `PlatformCapability` registry before any platform adapter ships (§9.8.1).
- Verify complete test coverage and add missing integration/E2E suites, including the SMAE failure-test list (§12.2).
- Complete and validate provider payment reconciliation and webhooks, including agent-originated order disputes.
- Complete platform adapters in the phased order of §9.8.7 — do not build Phase 3 platforms before Phase 1–2 are production-solid.
- Validate visual-search embedding generation, pgvector index strategy, and response thresholds against the <2s NFR (§1.0.1).
- Validate AI feed schemas, freshness, attribution, partner approval, and both kill switches (agent commerce §9.6.6, social automation §9.8.8).
- Reconcile any differences between the binding design tokens (§7.2) and actual web tokens/components.
- Confirm ownership, retention, backup, and incident-response policies for all operational data, including the Supabase plan tier's actual backup/PITR coverage.
- Implement malware scanning on vendor uploads.
- Pilot the MCP server (§9.6.4) before committing to full UCP/ACP integration work.
- Select a staging/production hosting target and add CI/CD workflows when those operational environments are established (§13.5).

Documentation is part of the system. Update this handbook when a command, deployment model, module boundary, workflow, security control, or feature status changes.
