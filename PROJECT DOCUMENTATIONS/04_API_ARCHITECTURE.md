# API ARCHITECTURE

Revision 2 — original endpoint groups retained; added the contracts (errors, pagination, idempotency, rate limits, auth), the endpoints required by specs 07–09 (escrow/payouts, shipping, tax, KYC, bulk import, notifications, privacy, SEO/LLM surfaces, MCP, UCP, internal n8n endpoints, health) and the correct UCP path.

Architecture Style: REST API (JSON), OpenAPI 3.1 generated from NestJS decorators (Swagger UI at `/api/docs`, JSON at `/api/docs-json`; client types generated into `packages/shared`).
Future Ready: GraphQL layer optional.
Versioning: URI `/api/v1`; breaking change = `/api/v2` with ≥ 6-month overlap and `Deprecation`/`Sunset` headers.

Public machine-readable endpoints (outside `/api` prefix, served at the storefront origin): `/.well-known/ucp`, `/.well-known/acp.json`, `/feeds/*`, `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap*.xml`, `/mcp`, IndexNow key file.

---

# CONTRACTS (binding)

**Auth.** `Authorization: Bearer <access JWT>` (15 min). Refresh via HttpOnly rotating cookie (`/auth/refresh`). Service-to-service (n8n → API): `X-Service-Key` (scoped, rotatable) + HMAC signature headers; service keys can only call `/internal/*` and explicitly scoped routes.

**Permissions & entitlements.** Each route declares `@Permissions(...)` (RBAC enum) and optionally `@Entitlement('social.automation.enabled')`; guard order: JWT → vendor membership → permission → entitlement → ownership → handler. Missing entitlement → `403` with `code: ENTITLEMENT_REQUIRED` and upgrade hint.

**Pagination.** Offset: `?page=1&pageSize=20` (max 100) → `{ data, meta:{ page, pageSize, total, totalPages } }`. Large/feeds/admin exports use cursor: `?cursor=&limit=` → `{ data, meta:{ nextCursor } }`.

**Sorting/filtering.** `?sort=-createdAt,price` (allow-listed fields), filters as explicit query params (`status`, `vendorId`, `from`, `to`, `q`), unknown params rejected (422).

**Errors.** `{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details":[{"field":"price","issue":"must be > 0"}], "requestId":"…" } }`. Codes: `UNAUTHORIZED, FORBIDDEN, ENTITLEMENT_REQUIRED, NOT_FOUND, VALIDATION_FAILED, CONFLICT, IDEMPOTENCY_REPLAY, RATE_LIMITED, PAYMENT_FAILED, OUT_OF_STOCK, PRICE_CHANGED, STATE_TRANSITION_INVALID, DEPENDENCY_UNAVAILABLE, INTERNAL`. HTTP: 400/401/403/404/409/422/429/5xx. Never leak stack traces/SQL.

**Idempotency.** `Idempotency-Key` header (UUID) required on: `POST /orders/create`, `/orders/payment`, payment/refund/payout actions, `/vendor/social-automation/queue/*`, publish endpoints, `/internal/*` mutations. Stored 24h with request hash; same key + same body → replay stored response (`Idempotent-Replayed: true`); same key + different body → `409 IDEMPOTENCY_REPLAY`.

**Rate limits** (per IP unauth / per user auth; `429` with `Retry-After`; headers `X-RateLimit-*`): public 60/min; authenticated 300/min; auth endpoints 10/min; search/autosuggest 120/min; visual search 10/min; MCP 60/min/client; feeds/well-known cacheable and CDN-rate-limited; webhooks per provider. Turnstile token required on register/login after failures/forgot-password/contact/review submit.

**Concurrency.** Mutable resources expose `ETag`/`version`; updates accept `If-Match` (409 on mismatch) for products, inventory, settings.

**Money/time.** Money `{ "amount": 129900, "currency": "PKR" }` (minor units). Timestamps ISO-8601 UTC.

**Webhooks (inbound)** — payment providers `/webhooks/payments/:provider`, carriers `/webhooks/carriers/:carrier`, social `/social/webhooks/:platform`, email provider `/webhooks/email`: verify signature + timestamp tolerance + nonce, persist raw event (unique provider event id), acknowledge `200` within 2 s, process asynchronously, idempotent.

**Outbound events.** Domain changes write `OutboxEvents` in the same transaction; dispatcher delivers to n8n (signed), IndexNow, revalidation, feeds, analytics.

**Caching.** Public GETs: `Cache-Control` + `ETag`; catalog endpoints cacheable at CDN with short TTL + tag purge; never cache authenticated/cart/checkout.

**Uploads.** Multipart or pre-validated; MIME sniffing, size caps, malware scan before use; stored in Supabase Storage by API (service role).

**Observability.** `X-Request-Id` in/out; `traceparent` propagated; audit logs for privileged actions.

## Phase 2 public catalog endpoints

The current API workspace implements these unauthenticated, versioned routes:

- `GET /api/v1/products` and `GET /api/v1/products/search`
- `GET /api/v1/products/:idOrSlug`
- `GET /api/v1/categories`, `GET /api/v1/brands`, and `GET /api/v1/vendors`

Product lists accept `page` (default 1, maximum 10,000), `pageSize` (default
20 maximum 100), `q` (2–100 characters), `category` and `brand` slugs,
`vendorId` (UUID), `minPrice` and `maxPrice` in minor units,
`availability=all|in-stock`, and
`sort=newest|popular|price-asc|price-desc|relevance`. Popularity sorts by units
in paid, COD-confirmed, and active fulfilment orders, then newest product first;
it is only available without `q`. Search requires `q`; relevance sorting is
only accepted with a query. Unknown parameters and invalid combinations return
422. Product lists use the standard `{ data, meta }` pagination envelope. Public
products must be active, approved, owned by an
approved vendor, assigned to active taxonomy records, and have an active
variant and at least one image. Product image URLs use the configured public
`SUPABASE_STORAGE_BUCKET_PRODUCT_MEDIA` bucket.

---

# AUTHENTICATION APIs

`POST /auth/register` · `/auth/login` · `/auth/logout` · `/auth/refresh` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/social-login` · `/auth/verify-email` · `/auth/resend-verification` · `/auth/2fa/enroll` · `/auth/2fa/verify` · `/auth/2fa/disable` · `/auth/step-up` · `GET /auth/me` · `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/otp/send` · `POST /auth/otp/verify`

# CUSTOMER APIs

`/customers` · `/customer/profile` · `/customer/orders` · `/customer/orders/:id` · `/customer/wishlist` · `/customer/addresses` · `/customer/reviews` · `/customer/rewards` · `/customer/support` · `/customer/payment-methods` · `/customer/notifications` · `/customer/notification-preferences` · `/customer/consent` · `/customer/privacy/export` · `/customer/privacy/delete` · `/customer/referrals` · `/customer/gift-cards` · `/customer/recently-viewed` · `/customer/product-alerts`

# VENDOR APIs

`/vendors` (public vendor store data) · `/vendor/register` · `/vendor/application` · `/vendor/documents` · `/vendor/agreements/accept` · `/vendor/profile` · `/vendor/products` (CRUD, `/:id/submit`, `/:id/archive`, `/:id/variants`) · `/vendor/products/import` (+`/:jobId`, `/template`, `/export`) · `/vendor/orders` (`/:id`, `/:id/shipments/:shipmentId/pack|ship|deliver`, `/:id/cancel`) · `/vendor/returns` (`/:id/respond`) · `/vendor/inventory` (`/warehouses`, `/adjust`, `/history`) · `/vendor/shipping-profiles` · `/vendor/payouts` · `/vendor/payouts/escrow` · `/vendor/payouts/statements/:id` · `/vendor/bank-account` (step-up) · `/vendor/analytics` · `/vendor/staff` · `/vendor/plan` (`/upgrade`, `/entitlements`) · `/vendor/coupons` · `/vendor/reviews` · `/vendor/questions` · `POST /uploads/product/:productId` · `/uploads/vendor-document`

# VENDOR SOCIAL AUTOMATION APIs (Premium Plans)

`/vendor/social-accounts` · `/vendor/social-accounts/connect/:platform` · `/vendor/social-accounts/disconnect/:platform` · `/vendor/social-accounts/:id/health` · `/vendor/social-automation/rules` · `/vendor/social-automation/rules/:id` · `/vendor/social-automation/queue` · `/vendor/social-automation/queue/:id/approve` · `/vendor/social-automation/queue/:id/reject` · `/vendor/social-automation/queue/:id/edit` · `/vendor/social-automation/generate-post` · `/vendor/social-automation/campaigns` · `/vendor/social-automation/analytics` · `/vendor/social-automation/pause-all` · `/social/webhooks/:platform`

# STORE SOCIAL AUTOMATION APIs (Marketplace-owned, Admin/Marketing)

`/admin/store-social/accounts` · `/admin/store-social/accounts/connect/:platform` · `/admin/store-social/curation-rules` · `/admin/store-social/queue` · `/admin/store-social/queue/:id/approve|edit|reject` · `/admin/store-social/sponsored-slots` · `/admin/store-social/fairness-report` · `/admin/store-social/analytics` · `/admin/store-social/pause-all` · `/vendor/store-social/opt-in` · `/vendor/store-social/tag-handle` · `/vendor/store-social/exclude-product/:productId` · `/vendor/store-social/performance`

# INTERNAL (service-scoped; n8n and workers only; `/api/v1/internal/*`)

`GET /internal/social/product-facts/:productId` · `POST /internal/social/events/ack` · `POST /internal/social/eligibility/check` · `POST /internal/social/posts` · `PATCH /internal/social/posts/:id/status` · `POST /internal/social/posts/:id/delivery-attempts` · `POST /internal/social/analytics/snapshots` · `POST /internal/social/webhook-events/:id/processed` · `GET /internal/social/accounts/:id/credentials-handle` (returns a short-lived provider call token reference, never raw long-lived secrets to AI nodes) · `POST /internal/social/workflow-runs`
All require service key + HMAC, are idempotent, rate-limited per workflow, and write audit events (06 §36–§39).

# AI AGENT COMMERCE & DISCOVERABILITY (public, machine-readable)

| Path | Notes |
|---|---|
| `GET /.well-known/ucp` | **UCP discovery profile** (spec version pinned; HTTPS; capabilities, transports, signing keys, payment handlers; discovery-only at launch). *Replaces the incorrect `/.well-known/commerce-manifest.json`; keep that path as a 301 to `/.well-known/ucp`.* |
| `POST /ucp/catalog/search`, `GET /ucp/catalog/products/:id` | Phase 1.5 |
| `POST /ucp/checkout-sessions`, `/:id` (update/complete/cancel), `GET /ucp/orders/:id` | Phase 2 (flag off) |
| `GET /.well-known/acp.json` | ACP capabilities when enabled |
| `GET /.well-known/oauth-authorization-server` | Identity linking (Phase 2) |
| `GET /feeds/google`, `/feeds/perplexity` | Pull feeds (Google-Shopping format); signed/optional token; ETag |
| OpenAI product feed | **Push job** to OpenAI endpoint (not a public URL); status via admin |
| `GET /llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/sitemap-*.xml`, `/{indexnow-key}.txt` | Generated |
| `GET <product/category/policy URL>.md` | Markdown twin |
| `POST /mcp` | Public read-only MCP server (streamable HTTP): `search_products`, `get_product_details`, `check_availability`, `list_categories`, `get_shipping_estimate`, `get_store_policies` |
| `/admin/agent-commerce/eligibility` · `/admin/agent-commerce/feed-status` · `/admin/agent-commerce/feeds/:protocol/run` · `/admin/agent-commerce/rejections` · `/admin/agent-commerce/kill-switch` · `/admin/discoverability/prompt-panel` · `/admin/discoverability/crawler-policy` | Admin |
| `/analytics/agent-attribution` | Attribution reporting |

# PRODUCT APIs

`/products` · `/products/:idOrSlug` · `/products/search` · `/products/suggest` (autosuggest) · `/products/visual-search` (POST multipart) · `/products/filter` (facets) · `/products/recommendations` · `/products/compare` · `/products/reviews` · `/products/:id/reviews` (POST, verified purchasers) · `/products/questions` · `/products/:id/questions` · `/categories` (+tree) · `/brands` · `/vendors/:slug/products` · `/deals` · `/flash-sales` · `/home/sections`

# CART & ORDER APIs

`/cart` (GET with `X-Cart-Session`/auth) · `/cart/items` · `/cart/items/:id` · `/cart/coupon` · `/cart/merge` · `/checkout/quote` (totals, shipping options, taxes) · `/orders` · `/orders/create` · `/orders/payment` · `/orders/:id/payment-status` · `/orders/track` (order no. + token) · `/orders/:id/cancel` · `/orders/:id/invoice` · `/orders/return` · `/orders/refund` · `/returns` (`/:id`, `/:id/shipping-label`) · `/shipping/estimate` · `/shipping/rates`

# PAYMENT & ESCROW APIs

`/payments/methods` · `/payments/:id` · `/payments/:id/refund` (admin/finance) · `/webhooks/payments/:provider` · `/admin/payments` · `/admin/payouts/escrow` (list/filter) · `/admin/payouts/escrow/:id/release` · `/admin/payouts/escrow/:id/reverse` · `/admin/payouts/batches` · `/admin/payouts/batches/run` (guarded by `payouts.release_job_enabled` flag + step-up) · `/admin/payouts/batches/:id/export` · `/admin/reconciliation/runs` · `/admin/chargebacks` · `/admin/tax/rates` · `/admin/ledger`

# MARKETING & LOYALTY APIs

`/coupons/validate` · `/gift-cards/redeem` · `/gift-cards/purchase` · `/rewards` · `/referrals` · `/affiliate/dashboard` · `/affiliate/links` · `/affiliate/payouts` · `/admin/coupons` · `/admin/campaigns` · `/admin/flash-sales` · `/admin/affiliates`

# CMS APIs

`/pages` · `/pages/:slug` · `/blogs` · `/blogs/:slug` · `/faqs` · `/banners` · `/menus` · `/legal/:type` (latest published) · `/admin/cms/*` (CRUD, versions, publish/schedule)

# SUPPORT & NOTIFICATION APIs

`/support/tickets` · `/support/tickets/:id/replies` · `/support/kb` · `/support/assistant` (AI chat, Phase 1.5) · `/admin/support/*` · `/notifications` · `/push/subscribe` · `/webhooks/email`

# ADMIN APIs

`/admin/vendors` (`/:id/approve|reject|suspend|documents`) · `/admin/customers` · `/admin/orders` · `/admin/products` (`/:id/approve|reject`, `/duplicates`) · `/admin/payments` · `/admin/reports` · `/admin/settings` · `/admin/feature-flags` · `/admin/roles` · `/admin/audit-logs` · `/admin/fraud/queue` · `/admin/system/health` · `/admin/system/queues` · `/admin/system/outbox` · `/admin/imports`

# ANALYTICS & CONSENT

`POST /events` (batched first-party events, consent-aware) · `POST /consent` · server-side pixel relay is internal (Meta CAPI/TikTok Events/GA4 MP with `event_id` dedupe).

# HEALTH & OPS

`GET /health/live` · `GET /health/ready` (DB, Redis, migration level) · `GET /health/version` · `GET /metrics` (internal network only)

---

# API RULES (consolidated)

JSON responses; pagination; sorting; filtering; search; rate limiting; Swagger documentation; OpenAPI compliance (contract tests in CI; breaking-change detector); JWT authentication; refresh tokens (rotating); OAuth support; consistent error handling; Subscription Tier / Entitlement gate guards (Social Automation and other premium-only routes); webhook signature verification (per platform/provider); idempotency keys on queue/publish/payment/order endpoints; validation (DTO whitelist, reject unknown); output shaping (never return secrets/hashes/tokens); least-privilege field selection; deprecation policy; backwards-compatible additive changes within a version.
