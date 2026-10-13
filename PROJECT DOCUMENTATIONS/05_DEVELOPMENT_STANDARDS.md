# DEVELOPMENT STANDARDS

Revision 2 — original standards retained and made enforceable; aligned with the Supabase + Upstash + n8n infrastructure; added git/PR/CI gates, dependency and security policy, observability, and the updated Cursor rule (now includes 08, 09 and the handbook).

Language: TypeScript strict mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` where practical; no `any` without an explained `// eslint-disable` comment). Node.js 20 LTS (pinned in `.nvmrc`, `engines`, CI, Docker).

---

# ARCHITECTURE

Clean Architecture · Domain Driven Design · SOLID · Repository Pattern · Dependency Injection · Modular Structure · Feature-Based Organization

Layering per feature module: `controller` (transport) → `application service/use-case` (orchestration, transactions, authorization context) → `domain` (entities, state machines, pure rules, no framework imports) → `repository` interface → `infrastructure` (Prisma repository, provider adapters). Domain code has no Prisma/Nest imports and is unit-testable in isolation. Cross-module calls go through exported services/interfaces, never another module's repository. Events (outbox) for async cross-module effects. State machines (order, shipment, payment, post, return) are explicit, table-driven and tested.

Monorepo: npm workspaces (`apps/web`, `apps/api`, `packages/database`, `packages/shared`); Turborepo for cached builds/tests. Shared enums/permissions/entitlements/DTO types live in `packages/shared`.

# CODE STANDARDS

Naming: camelCase (variables/functions), PascalCase (types/classes/components), snake_case (database only, via Prisma `@map`), kebab-case (files/routes), SCREAMING_SNAKE (constants/env). One responsibility per file; max function ~50 lines/complexity ≤ 10 (lint-enforced); no dead code; no commented-out code; no TODO without ticket id. Errors: typed domain errors mapped by a global filter; never swallow errors; no `console.log` (use logger). No secrets in code. Money is integer minor units — lint rule bans float arithmetic on money types (use a `Money` value object).

Architecture Decision Records: any decision that deviates from or extends these docs is recorded in `docs/adr/NNNN-title.md` in the same PR.

# FRONTEND STANDARDS

Next.js App Router · Server Components first · Client Components only when required · SEO optimized (SSR/ISR, metadata API, JSON-LD, sitemaps — 07 Part 1) · Accessibility first (03 §5) · Responsive/mobile first · Tailwind + shadcn/ui tokens only (03) · data via API only (no Supabase client in browser) · forms with React Hook Form + Zod (schemas shared with API DTO types where possible) · server state via TanStack Query or RSC fetch with cache tags · i18n via `next-intl` (all strings externalised) · `next/image` for all images · analytics/pixels behind consent · error boundaries and `loading.tsx`/`error.tsx`/`not-found.tsx` per route group · no `dangerouslySetInnerHTML` except sanitized CMS content (DOMPurify server-side) · feature flags read from a cached server endpoint.

# BACKEND STANDARDS

NestJS modules · Controllers (thin) · Services · Repositories · DTO validation (class-validator/zod, whitelist + forbidNonWhitelisted) · Exception filters (error contract in 04) · Interceptors (logging, request-id, timeout, serialization with allow-listed fields) · Guards (JWT, permissions, entitlements, ownership) · Pipes · Throttler (Redis store) · Swagger decorators on every route · BullMQ queues in a separate **worker** process (`apps/api` `worker` entrypoint) with typed job payloads, retries with backoff + jitter, DLQ, idempotent processors · scheduler as a separate leader-locked process · outbox dispatcher · graceful shutdown · config validated at boot (zod) — app refuses to start on invalid/missing production config.

# DATABASE STANDARDS

Prisma ORM (pinned version; if Prisma ≥ 7, connection config lives in `prisma.config.ts` and the pg driver adapter is used — follow the pinned version's docs) · Migration-driven development · Foreign keys · Indexes · Soft deletes · Audit columns · RLS default-deny (02) · expand/contract migrations · no destructive migration without backup + reviewed rollback plan · query review: no N+1 (use `include`/`select` deliberately), pagination mandatory on list queries, slow-query budget (500 ms) · all coupled commerce writes in transactions · seeds idempotent and environment-guarded.

# TESTING

Unit Tests (domain rules, state machines, calculators: commission, tax, loyalty, shipping, price) · Integration Tests (repositories/Prisma against a disposable test DB, Redis/BullMQ, provider adapters with recorded fixtures, webhook handlers, outbox) · E2E Tests (Playwright: purchase card/COD, vendor onboarding→listing→ship, returns, admin approval, social flow with provider stubs, SEO/no-JS HTML check) · Contract tests (OpenAPI, UCP/MCP schemas, feed schemas, provider webhooks) · Security tests (IDOR/vendor isolation matrix on every `:id` route, permission/entitlement matrix) · Load tests (09 §10) · Accessibility tests (axe in CI) · Visual regression on key templates.
Minimum Coverage: **80% lines/branches on domain + application layers**, 100% of state-machine transitions and money/commission/tax/payout calculations; coverage gates fail the build. Tests are deterministic (frozen clock, seeded randomness), isolated, parallel-safe. Bug fix = failing test first.

# QUALITY TOOLS

ESLint (typescript-eslint strict, import/boundaries rules enforcing layer/dependency direction, a11y plugin for JSX) · Prettier · Husky · Lint-Staged · Commitlint (Conventional Commits: `feat|fix|docs|refactor|test|chore|perf|ci(scope): …`) · TypeScript `tsc --noEmit` · `knip`/dead-export check · Renovate/Dependabot · CodeQL · gitleaks secret scanning · `npm audit` (fail on high/critical) · license check · SBOM (CycloneDX) per release.

# GIT AND REVIEW WORKFLOW

Trunk-based: short-lived branches from `main`, PR required, ≥ 1 approving review (2 for auth/payments/payout/escrow/RLS/migrations/security), CODEOWNERS for sensitive paths, required status checks (below), squash merge, linear history, signed commits recommended. Branch names `feat/…`, `fix/…`. PR template: spec reference, handbook sections touched, test evidence, migration notes, rollback plan, screenshots (UI), feature flag state, checklist (handbook §15). Releases: semantic version tags, changelog generated from commits, deploy staging automatically, production by manual approval.

# CI REQUIRED CHECKS (merge blockers)

install (frozen lockfile) → generate Prisma → typecheck → lint → unit/integration tests with coverage gate → build web+api → migration check (apply all migrations to a clean DB + schema drift check + RLS-on-every-table test) → OpenAPI diff (no unreviewed breaking change) → e2e smoke (Playwright, critical paths) → axe a11y → Lighthouse CI budgets → JSON-LD/SEO checks (07 §1.10) → security scans (CodeQL, gitleaks, audit, container scan) → bundle-size budget.

# SECURITY

JWT (short-lived) + rotating refresh · RBAC + entitlements · 2FA Ready (mandatory for admin/finance/super-admin — 08 §1) · CSRF Protection (SameSite cookies + double-submit for cookie-authenticated mutations) · XSS Protection (output encoding, CSP nonce, sanitize rich text, no inline handlers) · SQL Injection Protection (Prisma parameterization; raw SQL only via tagged `$queryRaw`, reviewed) · SSRF protection for any server-side URL fetch (allow-list schemes/hosts, block private IP ranges, timeouts, size caps) · Audit Logging · OAuth Token Encryption At Rest (AES-256-GCM, key from secret store, key id for rotation) · Social Platform API Policy Compliance (rate limits, no spam posting) · Password hashing Argon2id · rate limiting + Turnstile · secure headers (09 §6) · dependency pinning/lockfile · secrets in secret stores only · least-privilege DB roles · webhook signature verification · file-upload hardening (type sniffing, size, malware scan, private by default) · PII minimisation and log redaction · security review checklist per PR touching auth/payments/uploads/OAuth · threat model documented for checkout, payouts, social OAuth, MCP/UCP endpoints · responsible disclosure `security.txt`.

# PERFORMANCE

SSR · ISR with on-demand revalidation · Redis Cache (cache-aside, tag invalidation via outbox) · CDN (Cloudflare) · Image Optimization · Lazy Loading · Core Web Vitals Optimization (03 §20) · DB indexes/EXPLAIN reviews · connection pooling discipline · background work off the request path · pagination everywhere · N+1 prevention · HTTP compression · bundle budgets.

# DEVOPS

Docker (multi-stage, non-root, pinned base images, healthcheck) · Kubernetes Ready (12-factor config, stateless processes, probes, resource limits — start on a single-container host, cluster only when a scale trigger is hit, handbook §0.1) · GitHub Actions (CI/CD, environments with required reviewers) · Cloudflare CDN/WAF · Sentry · Grafana · Prometheus/OpenTelemetry · Automated Backups (Supabase PITR + off-site logical dumps + Storage replication, 09 §5) · Redis + BullMQ Worker Processes (Social Post Scheduling Queue, feeds, embeddings, notifications, outbox) · Dead-Letter Queue Monitoring and alerting · Infrastructure documented as code where feasible (Dockerfile, workflow YAML, `supabase/` config, n8n workflow exports in `workflows/n8n/`) · environment parity (dev/staging/prod) · release/rollback runbooks (09 §8).

# OBSERVABILITY

Structured logs (pino) with `requestId`, `correlationId`, `userId`/`vendorId` (hashed where needed), no PII/secrets · metrics (RED for HTTP, queue depth/age, job duration, DB pool, cache hit rate, external API latency/errors) · tracing (OpenTelemetry, spans for DB/HTTP/queue/provider calls) · Sentry releases + source maps · SLOs/alerts per 09 §7 · audit trail for privileged actions.

# DOCUMENTATION

Handbook updated in the same PR as any command/env/architecture change · OpenAPI is the API reference · ADRs for decisions · runbooks for ops · Storybook for UI · README per package · inline docs only for non-obvious "why".

# CURSOR RULE

Always read, **in this order**, before generating code:

00_DEVELOPER_HANDBOOK.md (operational source of truth: setup, environments, process, build plan)
01_PROJECT_MASTER_SPECIFICATION.md
02_DATABASE_ARCHITECTURE.md
03_UI_UX_DESIGN_SYSTEM.md
04_API_ARCHITECTURE.md
05_DEVELOPMENT_STANDARDS.md
06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md
07_AI_AGENT_COMMERCE_READINESS.md
08_BUSINESS_RULES_AND_DOMAIN_FLOWS.md
09_LAUNCH_READINESS_AND_OPERATIONS.md

These files are the source of truth. Never make architectural assumptions that conflict with the specifications. Where a spec is silent, apply the resolved default in 08/handbook; if still silent, choose the most conservative secure option, record it as an ADR and an entry in `docs/ASSUMPTIONS.md`, and continue — do not stop the build for questions that a documented default answers. Items marked **[SIGN-OFF]** are built behind settings/flags and never enabled automatically. Follow the handbook build plan order. Generate production-ready enterprise-grade code only: no placeholder logic, no mocked data in production paths, no TODO stubs presented as complete, every feature with tests, error/empty/loading states and audit/observability hooks.
