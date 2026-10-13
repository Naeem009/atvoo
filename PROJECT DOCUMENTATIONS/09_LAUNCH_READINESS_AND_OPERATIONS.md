# LAUNCH READINESS AND OPERATIONS

Companion spec to 01–08. Defines what must exist, in what order, for the platform to be deployed **once** and go live without rework: external approvals (long lead time), production topology, Supabase hardening, observability, security, DR, load testing, launch sequence and the go-live gate. Items marked **[LEAD TIME]** take calendar time and must start on day 0 — they are the usual reason launches slip.

## 1. Go-live principle

Code-complete ≠ launch-ready. Launch happens only when **every box in §14 is checked** by a named owner. Anything not ready at launch ships **disabled behind a feature flag** (08 §20), not half-working.

## 2. External approvals and accounts — start immediately **[LEAD TIME]**

Durations are planning estimates; confirm with each provider.

| # | Item | Why it blocks launch | Typical lead time | Owner |
|---|---|---|---|---|
| 1 | Domain registered, DNS provider (Cloudflare), registrar lock, 2FA | Everything | 1 day | Ops |
| 2 | Business entity docs, bank account, tax registration (NTN etc.) | PSP, Merchant Center, Meta verification | days–weeks | Founder |
| 3 | Payment service provider merchant account (card) + JazzCash + Easypaisa merchant accounts | Checkout | 1–4 weeks | Finance |
| 4 | Courier contracts / COD remittance terms | COD + shipping adapters | 1–3 weeks | Ops |
| 5 | **Meta**: Business Manager verification, developer app, App Review for publishing permissions (Facebook Pages, Instagram content publishing), Advanced Access, privacy-policy URL, data-deletion callback, screencast demos | Social automation Phase 1 | 1–6+ weeks (rejections common) | Social lead |
| 6 | **TikTok** developer app + Content Posting API audit (unaudited apps are limited, e.g. private-only posts) | Social Phase 3 | 1–4 weeks | Social lead |
| 7 | **Pinterest** developer app: Trial → Standard access upgrade | Social Phase 3 | 1–3 weeks | Social lead |
| 8 | **X** developer account and paid API tier sized for expected posts/month | Social Phase 3 | days; cost decision | Social lead |
| 9 | **Google Business Profile API** access request | Social Phase 5 | 1–4 weeks | Social lead |
| 10 | WhatsApp Business (Cloud API) number verification, template approval | Notifications + catalog | 1–3 weeks | Ops |
| 11 | **Google Merchant Center** account, domain claim/verification, shipping/returns/tax config, feed validation; confirm country eligibility | Google/Gemini shopping | 1–3 weeks | Marketing |
| 12 | **Bing Merchant Center** + Webmaster Tools + IndexNow key | Copilot/Bing | days | Marketing |
| 13 | **OpenAI merchant/product-feed application** (feed spec, allow-listed endpoint, sample feed validation) | ChatGPT shopping | weeks (approval-gated) | Marketing |
| 14 | Perplexity merchant program application | Perplexity shopping | weeks | Marketing |
| 15 | Google Search Console + Bing Webmaster verification, sitemap submitted | Indexing | 1 day | Marketing |
| 16 | Email domain auth: SPF, DKIM, DMARC (p=none → quarantine), Resend domain verified, bounce/complaint webhooks | Deliverability | 1–2 days (warm-up weeks) | Ops |
| 17 | SMS aggregator + WhatsApp templates for OTP/order updates | COD OTP | 1–2 weeks | Ops |
| 18 | Supabase **Pro** (prod, staging) + PITR add-on + compute sizing; n8n Cloud plan (prod/staging/dev workspaces); Upstash Redis prod; Sentry; Cloudflare plan; hosting accounts | Infra | 1 day | Ops |
| 19 | Legal: Terms/Privacy/Seller Agreement/returns reviewed **[SIGN-OFF]**; accountant tax sign-off | Compliance | 1–3 weeks | Legal |
| 20 | Escrow/payout model sign-off (handbook §0.2) | Real vendor payouts | 1–4 weeks | Finance/Legal |
| 21 | Penetration test vendor booked (post-feature-freeze) | Security gate | 2–4 weeks | Security |
| 22 | App/site brand assets: logo, favicons, OG images, social profiles (created and verified on every platform; consistent name/handle; linked in `sameAs`) | Social + LLM trust signals | days | Marketing |

## 3. Environments

| Env | Supabase project | API/Worker host | Web | n8n | Redis | Purpose |
|---|---|---|---|---|---|---|
| local | dev project or local Postgres | local | local | personal workspace | local/Upstash dev | developer |
| dev (shared) | `atvoo-dev` | auto-deploy from `develop` | Vercel preview | n8n dev | Upstash dev | integration |
| staging | `atvoo-staging` (Pro) | auto-deploy from `main` | Vercel staging | n8n staging | Upstash staging | UAT, load tests, provider sandboxes |
| production | `atvoo-prod` (Pro + PITR) | manual-approved deploy of tagged release | Vercel prod | n8n prod | Upstash prod | live |

Separate credentials per environment (OAuth apps, PSP keys, n8n service keys, Supabase keys). Production secrets only in the host/GitHub environment secret stores; access limited to named owners.

## 4. Production topology and process model

```text
Cloudflare (DNS, CDN, WAF, bot management with verified-bot allowlist, TLS)
  ├─ Web: Next.js on Vercel (apps/web)  → NEXT_PUBLIC_API_URL
  └─ API host (container, long-running) — same image, different commands:
       api        : NestJS HTTP (min 2 instances, health/readiness probes)
       worker     : BullMQ consumers (feeds, embeddings, notifications, imports, outbox dispatcher, IndexNow, revalidation)
       scheduler  : single-instance cron runner w/ leader lock (payout batches, reservation expiry, trending jobs, feed pushes, reconciliation, retention/anonymisation)
Supabase (Postgres+pgvector via pooler; Storage; backups) ←→ api/worker/scheduler
Upstash Redis (cache, rate limits, BullMQ)
n8n Cloud (SMAE orchestration) ↔ api (signed webhooks, scoped service key)
Resend / SMS / WhatsApp / PSP / carriers / OpenAI-Google-Bing feeds (outbound)
Sentry, log drain, uptime monitor, status page
```

Rules: workers and scheduler never run inside `api` instances; scheduler uses a Postgres advisory lock or Redis lock so only one runs jobs; all jobs idempotent; graceful shutdown (drain 30s); `/health/live` (process), `/health/ready` (DB, Redis, migrations level) endpoints (no secrets); zero-downtime deploy (rolling, backward-compatible migrations — expand/contract pattern).

Region: choose the Supabase region and API host region **closest to customers and to each other** (latency API↔DB < 10 ms target); document the choice; Vercel function region (if any) matches.

## 5. Supabase production hardening (checklist)

- Plan: **Pro** minimum for staging and prod (Free pauses after inactivity and has no backups). **PITR add-on on prod** (daily snapshots alone = up to 24h data loss). Compute size chosen from load test, not guess; enable spend-cap review.
- **Network restrictions** on the database to API/worker/scheduler/CI egress IPs where the host provides static egress; otherwise rely on strong credentials + SSL enforcement. **Enforce SSL**.
- Run **Security Advisor** and **Performance Advisor**; zero ERROR-level findings at launch (RLS enabled on all tables — handbook §8.6; no exposed functions/views).
- Disable/avoid unused PostgREST exposure: restrict exposed schemas; anon/authenticated roles have no grants; Realtime/Edge Functions/Auth not enabled for use.
- Extensions: `vector`, `pg_trgm`, `pgcrypto`, `uuid-ossp` or v7 generator function, `unaccent`; created via `supabase/migrations`.
- Pooler: transaction mode (6543) for runtime with correct `connection_limit` per instance (sum across instances < pooler/DB limits); direct/session (5432) only for migrations/CI.
- Prisma: pin versions; `prisma migrate deploy` only in CI against `DIRECT_URL`; no `migrate dev`/`reset` outside dev project. Slow-query logging (`log_min_duration_statement` 500 ms) and `pg_stat_statements` reviewed weekly.
- Indexes defined for every FK and common filter/sort; FTS GIN; HNSW on embeddings; partial indexes for active products; `EXPLAIN` reviewed on top 20 queries during load test.
- **Backups beyond Supabase:** nightly logical `pg_dump` (custom format) to an off-site, versioned, encrypted object store (e.g., Cloudflare R2/S3) with 30-day + monthly retention; **Storage buckets replicated/backed up separately** (Supabase DB backups do not include stored objects); restore drill quarterly. Backup credentials separate from app credentials.
- Storage: buckets `product-media` (public-read), `social-assets` (public-read after approval or signed), `vendor-docs` (private), `support-attachments` (private), `invoices` (private), `exports` (private, short TTL); MIME and size limits enforced in API and bucket config; malware scan pipeline before objects become referenced (ClamAV worker or provider API) — **launch-blocking for vendor-uploaded files**.
- Database roles: separate least-privilege role for the app (no superuser), read-only role for analytics/BI, migration role used only by CI.
- Org hygiene: ≥ 2 owners with 2FA, access review quarterly, API keys rotated on staff change.

## 6. DNS, TLS, CDN, WAF, email

- Cloudflare: proxied web + API, TLS Full (strict), HSTS (preload after stable), Always HTTPS, Brotli, caching rules (static assets immutable; HTML per Next.js headers; **never cache authenticated or cart/checkout**), WAF managed rules + rate limits (login, search, visual search, MCP, feeds), bot management with **verified-bot allowlist** (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot, Applebot) so LLM crawlers are never challenged, Turnstile on forms.
- Security headers (Next.js middleware + Cloudflare): CSP (nonce-based, report-only for 2 weeks then enforce), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, frame-ancestors none, CORP/COOP as feasible. Cookie flags per 08 §1.
- Email: SPF, DKIM, DMARC with reporting mailbox; separate subdomain for marketing vs transactional; list-unsubscribe headers.
- Canonical host: apex vs `www` decided once; 301 the other; HTTPS only; trailing-slash policy consistent.

## 7. Observability and SLOs

- **Stack:** Sentry (web, api, worker; release tracking, source maps), structured JSON logs (pino) with `requestId`/`correlationId` → log drain (e.g., Better Stack/Datadog/Grafana Loki), metrics via OpenTelemetry/Prometheus endpoint → Grafana, uptime monitoring (external, multi-region), status page.
- **SLOs (30-day):** storefront availability 99.9%; API p95 latency < 500 ms (read) / < 1 s (checkout); checkout success rate ≥ 98% (excluding declines); search p95 < 300 ms; visual search p95 < 2 s; feed freshness < 24 h; bot-facing 5xx < 0.1%; webhook processing p95 < 5 s.
- **Alerts (page on-call):** availability probe fails 2×; error rate > 2% 5 min; checkout failures spike; payment webhook backlog; payout/reconciliation mismatch; DB CPU/connections > 80%; replication/backup failure; DLQ count > threshold; outbox lag > 5 min; feed stale/rejection spike; social token-expiry wave; disk/Storage quota; certificate expiry < 14 d.
- Dashboards: business (orders, GMV, conversion, AOV, vendor funnel), ops (latency, errors, queues), SMAE (06 §46 metrics), AI visibility (07 §1.9), finance (escrow held/released, payouts, refunds).
- On-call rota + escalation, incident severity levels, post-incident review within 5 business days.

## 8. Runbooks (written before launch, stored in `docs/runbooks/`)

1. Deploy/rollback (API, web, migrations, n8n workflows).
2. DB restore (PITR, snapshot, logical dump) and Storage restore.
3. Payment provider outage / webhook backlog / reconciliation mismatch.
4. COD remittance mismatch.
5. Queue/DLQ drain and replay; outbox stuck.
6. Social incident: mass post failure, token expiry wave, wrong content published (kill switch, delete/retract procedure).
7. Feed rejection / stale feed / price mismatch with Merchant Center or OpenAI.
8. LLM crawler blocked (WAF/robots) diagnosis.
9. Security incident (secret leak, account takeover, data exposure, RLS gap) — includes legal notification timelines.
10. Vendor fraud/counterfeit takedown.
11. Maintenance mode / traffic surge (scale-up, rate-limit tighten, cache warm).
12. Key rotation (JWT, Supabase service role, n8n, PSP, OAuth apps).

## 9. Disaster recovery

| Target | Value |
|---|---|
| RPO (database) | ≤ 5 min (PITR) |
| RTO (full service) | ≤ 4 h |
| RPO Storage | ≤ 24 h (nightly replication) |
| DR drill | quarterly restore of staging from prod backup; documented timings |

Region-failure plan: restore latest logical dump + Storage replica into a standby Supabase project in an alternate region, repoint `DATABASE_URL`, rebuild API host from the same image, DNS failover via Cloudflare. Feature-flag `maintenance.mode` for read-only operation during recovery.

## 10. Quality gates before launch

- **Security:** dependency audit clean (no high/critical), SAST (CodeQL), secret scanning, container image scan, SBOM generated; external penetration test of web, API, auth, payouts, OAuth flows with all critical/high findings fixed; OWASP ASVS L2 checklist for auth/session/access control; IDOR tests for every `:id` route (vendor isolation); rate-limit tests; webhook signature/replay tests; file-upload abuse tests; SSRF tests on URL-fetching features.
- **Load:** k6/Artillery scenarios on staging at ≥ 3× expected peak: browse/search, product view, cart, checkout (with PSP sandbox), vendor dashboard, feed generation, social queue burst, MCP/crawler burst (50 req/s). Pass criteria = SLOs in §7 with DB CPU < 70%.
- **Accessibility:** automated (axe) + manual keyboard/screen-reader pass on home, listing, product, cart, checkout, account, vendor product form.
- **Cross-browser/device:** last 2 versions Chrome/Safari/Firefox/Edge; iOS Safari, Android Chrome; low-end Android + 3G throttling run.
- **SEO/LLM:** 07 §1.10 CI checks green on production-like staging; Merchant Center diagnostics clean; OpenAI sample feed validated; prompt-panel baseline recorded.
- **Data:** migrations applied on a copy of production-size data; seed/reference data verified; no demo accounts/data in production.
- **Provider sandboxes:** full order lifecycle with PSP sandbox, COD, carrier sandbox/manual, email/SMS/WhatsApp templates, one real test post per social platform on a **test** account in staging.
- **UAT:** scripted end-to-end scenarios signed off by business owner: customer purchase (card/COD), vendor onboarding→listing→order→ship→payout simulation, return/refund, admin approval, social post auto-flow, LLM-feed validation.

## 11. Launch sequence (recommended)

1. **T-4 weeks:** feature freeze for launch scope; pen test starts; provider approvals in flight; content (policies, categories, brand pages) loaded in staging.
2. **T-2 weeks:** load + DR drill; UAT; legal/finance sign-offs; production environment provisioned and *empty-state* smoke tested; Merchant Center/OpenAI sample feeds validated.
3. **T-1 week:** production data seeded (reference data only); vendor cohort onboarded (curated **10–30 vendors**, cold-start strategy in 01 §13) and listings approved; store social channels connected; robots/sitemaps/IndexNow verified; analytics + consent verified.
4. **Soft launch (T-0):** invite-only/real orders at low volume, `social.vendor_automation_enabled` for a pilot vendor subset, agentic checkout OFF, payouts job OFF until sign-off. Daily review for 7 days.
5. **Public launch:** remove invite gate, enable feeds publicly, announce, enable Mode B store-channel posting cadence, submit sitemaps, begin weekly LLM prompt-panel tests.
6. **T+30:** review SLOs, fraud/chargeback rates, vendor SLA metrics, feed rejections, citation rate; decide Phase 1.5/2 enablement.

Rollback: every release tagged; previous image retained; DB changes backward-compatible for one release; feature flags to disable social/AI/agent surfaces instantly; documented decision authority for rollback.

## 12. Post-launch cadence

Weekly: prompt-panel results, feed rejections, DLQ/SMAE failures, vendor SLA report, fraud queue. Monthly: dependency updates, backup restore test (sampled), access review, cost review (Supabase compute, n8n executions, AI tokens, social API fees). Quarterly: verify UCP/ACP/OpenAI feed/crawler/provider specs and Meta/TikTok/X/Pinterest API versions against current docs; DR drill; pen-test follow-up; policy review.

## 13. Cost and capacity guardrails

AI generation and embeddings: per-vendor and global monthly token/cost budgets with alerts at 80% and hard stop at 100% (feature-flagged degrade to manual). n8n execution budget alarms. Social API quota tracking. Supabase compute/egress alerts. Upstash command limits alerts. Image transformation cost review.

## 14. Go-live gate checklist (all required)

- [ ] §2 items 1–3, 11–16, 18–19 complete; items 5–10, 13–14, 17, 20 complete **or** their dependent features are flagged OFF with documented plan.
- [ ] Supabase prod on Pro + PITR; Security/Performance Advisor clean; RLS on all tables; backups + Storage replication + restore drill passed.
- [ ] Separate prod secrets; no dev/staging credentials in prod; key rotation runbook tested.
- [ ] CI green: build, lint, unit/integration/E2E, coverage ≥ 80% on domain modules, JSON-LD/SEO checks, Lighthouse budgets.
- [ ] Pen test: no open critical/high; IDOR/vendor-isolation suite green.
- [ ] Load test passed at 3× peak; SLO dashboards and alerts live; on-call staffed; status page live.
- [ ] Runbooks (§8) written and rehearsed (at least 1, 2, 3, 6).
- [ ] Payments: end-to-end sandbox + live-money smoke test (small real transactions, refunded); webhook idempotency verified; reconciliation job working; payout job flag state decided.
- [ ] Legal pages published, consent banner working, privacy requests process defined.
- [ ] LLM discoverability: robots.txt policy live, sitemap submitted, JSON-LD valid, SSR without JS verified, `llms.txt`, `/.well-known/ucp` (discovery-only), MCP server, Google/Bing/OpenAI/Perplexity feeds submitted/validated per approval status; verified-bot allowlist tested from a real crawler UA test.
- [ ] Social: Mode B accounts connected and test-posted; Mode A pilot vendors consented; kill switches tested; approval default policy set; DLQ + alerting verified.
- [ ] No demo/test data or credentials in production; admin accounts have mandatory 2FA.
- [ ] Business sign-offs recorded: product owner, finance, legal, security, operations.
