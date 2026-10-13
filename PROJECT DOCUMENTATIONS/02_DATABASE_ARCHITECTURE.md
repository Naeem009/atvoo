# DATABASE ARCHITECTURE

Revision 2 — reconciles the social-automation model with 06 §27, defines the order/sub-order model, adds the tables required by specs 07–09 and the Supabase conventions. All original modules are retained.

Database Engine: **PostgreSQL 17+ on Supabase (Pro in staging/prod)**, extensions `vector` (pgvector), `pg_trgm`, `pgcrypto`, `unaccent`
ORM: Prisma (version pinned; migrations are the only way schema changes)
ID Strategy: **UUID v7** (time-ordered). Postgres 17 has no native `uuidv7()`; create `public.uuid_generate_v7()` in the first migration and use `@default(dbgenerated("public.uuid_generate_v7()"))`. Never use random v4 for primary keys.

---

# CONVENTIONS (binding)

| Topic | Rule |
|---|---|
| Naming | Prisma models PascalCase singular (`Product`), mapped to snake_case plural tables (`@@map("products")`); fields camelCase mapped to snake_case columns (`@map`). |
| Timestamps | `timestamptz`, stored UTC: `createdAt`, `updatedAt` on every table; `deletedAt` on soft-deletable tables. |
| Soft delete | `deletedAt` for business entities (users, vendors, products, variants, reviews, pages…). Append-only ledgers/logs/history are never soft-deleted nor updated. Partial unique indexes use `WHERE deleted_at IS NULL`. |
| Audit columns | `createdBy`, `updatedBy` (user id or system actor id) on mutable business tables; sensitive changes also write `AuditLogs`. |
| Money | `bigint` minor units + `currency` char(3) on each money-bearing row. No float/decimal for money. Rates (commission, tax) as `numeric(7,4)` basis or `integer` basis points. |
| Enums | Postgres enums via Prisma for closed state machines (order, shipment, payment, post status). Open lists (reasons, carriers) are lookup tables. |
| JSONB | Only for provider payloads, settings values and flexible attributes; never for fields queried in WHERE/JOIN without a generated column/index. |
| Foreign keys | Always declared; `ON DELETE RESTRICT` default; `CASCADE` only for pure child rows (e.g., ProductImages). |
| Indexes | Every FK indexed; composite indexes for list filters/sorts (e.g., `(vendorId, status, createdAt desc)`); GIN for `tsvector`; HNSW for embeddings; partial indexes for active/visible rows. |
| Concurrency | `version int` (optimistic lock) on Inventory, Orders, Payments, EscrowHoldings, VendorPayouts, Products. Conditional atomic updates for stock. |
| Transactions | ACID; multi-row commerce mutations in one transaction together with the outbox row (OutboxEvents). |
| Row Level Security | **RLS enabled with default-deny on every table** in the same migration that creates it (handbook §8.6). Policy SQL lives in `supabase/migrations`. |
| Privacy | PII columns catalogued in `DataClassification` doc; secrets (OAuth tokens, bank accounts, TOTP secrets) encrypted at app level and never selected by default (`select` allow-lists). |
| Retention | Per-table retention in 08 §19; jobs anonymise/purge; legal-hold flag respected. |
| Multi-tenancy | Every vendor-owned row carries `vendorId`; every query on vendor routes includes it; marketplace-owned rows use explicit `owner = MARKETPLACE`. |

---

# AUTHENTICATION MODULE

Users, Roles, Permissions, RolePermissions, UserRoles, Sessions, RefreshTokens (hashed, family id, rotated_at, reuse_detected_at), OAuthAccounts, Devices, EmailVerifications, PasswordResets, TotpSecrets (encrypted), RecoveryCodes (hashed), LoginAttempts, ConsentRecords

---

# CUSTOMER MODULE

Customers, CustomerAddresses, SavedPaymentMethods (provider token + last4/brand only), RewardPoints (append-only ledger), CustomerGroups, CustomerSegments, PrivacyRequests (export/delete)

---

# VENDOR MODULE

Vendors (status state machine, trust_level, probation flags), VendorStaff, VendorFollowers, VendorDocuments (private storage refs, verification status), VendorBankAccounts (encrypted), VendorAgreements + VendorAgreementAcceptances, VendorPayouts, VendorSubscriptions, Plans, PlanEntitlements, VendorAnalytics, VendorScores, ShippingProfiles, ShippingZones, ShippingRates

---

# SOCIAL MEDIA AUTOMATION MODULE

> **Supersedes the original list.** 06 §27 states the original list was insufficient; `SocialPosts`/`SocialPostTargets` are the authoritative content/delivery objects. `SocialPostQueue` is only an operational projection.

## Mode A — Vendor Channel (vendor-owned accounts)

VendorSocialAccounts (encrypted tokens, status, scopes, capabilities, last_validated_at)
SocialAutomationRules, SocialAutomationTriggers
SocialCampaigns, SocialCampaignTargets
SocialPosts (authoritative content), SocialPostVariants, SocialPostAssets
SocialPostTargets (post × destination; fields per 06 §29)
SocialPostDeliveryAttempts (append-only history; fields per 06 §30)
SocialPostTemplates
SocialPostAnalytics (periodic snapshots)
SocialPostQueue (projection only)
SocialContentUsage (cooldown/dedupe memory)

## Mode B — Store Channel (marketplace-owned accounts)

StoreSocialAccounts, StoreCurationRules, StoreSocialPostQueue (projection; authoritative posts still in SocialPosts with `owner = MARKETPLACE`), StoreSocialPostAnalytics, VendorStoreFeatureOptIn, SponsoredSlotBookings

## Shared

PlatformCapability (per-platform capability registry — 06 §5), SocialPlatformApprovals (provider approval evidence per platform/permission set — 06 addendum A3), PromptTemplates (versioned AI prompts + JSON schemas — 06 A6), SocialContentProvenance (model/prompt version/inputs hash per generated content — 06 §44), SocialPlatformWebhookEvents (append-only; unique `(platform, external_event_id)`), SocialContentModerationLogs, SocialRateLimitEvents, SocialWorkflowRuns (n8n execution reference, workflow_version, correlation_id; never secrets), SocialAccountHealth

---

# VISUAL SEARCH MODULE

ProductImageEmbeddings (`vector(N)`, `embedding_model`, `embedding_version`, HNSW cosine index), VisualSearchQueries (image retention 24h), VisualSearchResults, ProductTextEmbeddings (semantic search, Phase 1.5)

---

# AI AGENT COMMERCE & DISCOVERABILITY MODULE

AgentProductFeedExports (per-protocol snapshots, status, validation report, pushed_at), AgentCommerceManifest (UCP profile config incl. spec version, capabilities, signing key ids), AgentSigningKeys (ECDSA P-256 public metadata; private key in secret store), AgentEligibilityFlags (per product: `is_eligible_search`, `is_eligible_checkout`, reasons), AgentOrderAttribution (agent, protocol, source_ref), FeedRejections (Merchant Center/OpenAI reject log), CrawlerPolicy (via PlatformSettings), SlugRedirects, SeoSettings, IndexNowSubmissions, AiVisibilityChecks (prompt-panel runs and results), McpRequestLogs

---

# PRODUCT CATALOG

Categories (tree, attribute templates, tax class, commission override, restrictions), Brands, Products, ProductVariants, Attributes, AttributeValues, ProductAttributeValues, ProductImages, ProductVideos, ProductDocuments, ProductTags, ProductFAQs, ProductSEO, ProductQualityScores, ProductApprovals (history: reviewer, decision, reason), ProhibitedItemRules, ProductImports (+ImportRowErrors), FlashSales, FlashSaleItems

---

# INVENTORY MODULE

Warehouses, Inventory, InventoryTransactions (append-only), StockReservations (TTL), LowStockAlerts

---

# ORDER MANAGEMENT

Orders, OrderItems (`vendorId`, `shipmentId`), OrderStatusHistory, Shipments, ShipmentTracking, Returns, ReturnItems, ReturnReasons, Refunds, Invoices (sequential numbering, private PDF ref), CreditNotes, Carts, CartItems

**Sub-order model (binding):** there is **no** `VendorOrders`/`SubOrders` table. A vendor's portion of an order is the set of `OrderItems` with the same `vendorId`, tied to exactly one `Shipment` per `(orderId, vendorId)`. `Shipments.vendorId` is required and indexed. `OrderStatusHistory` references either the `Order` (buyer-facing states) or the `Shipment` (fulfilment states). Customer-facing APIs aggregate to the Order; vendor APIs filter to their Shipment/OrderItems.

---

# PAYMENT MODULE

Payments, Transactions (append-only ledger), PaymentMethods, PaymentLogs, PaymentWebhookEvents (unique `(provider, event_id)`), VendorPayouts, PayoutBatches, PayoutItems, EscrowHoldings (status HELD/RELEASED/REVERSED, release_after, per Shipment), LedgerAccounts + LedgerEntries (double-entry for platform/vendor/escrow/commission/tax), CarrierRemittances (COD), Chargebacks, TaxClasses, TaxRates, Currencies, ExchangeRates, ReconciliationRuns

---

# MARKETING MODULE

Coupons, CouponUsage, GiftCards, GiftCardTransactions, ReferralPrograms, Referrals, Affiliates, AffiliateClicks, AffiliateCommissions, Campaigns, AdPlacements, AdCampaigns (Phase 2), Memberships (reserved)

---

# CUSTOMER ENGAGEMENT

Reviews (+ReviewMedia), ReviewVotes, Questions, Answers, Wishlists, WishlistItems, CompareLists, RecentlyViewed, ProductAlerts, Reports (abuse), SearchSynonyms, SavedSearches

---

# CMS MODULE

Pages (versioned), PageVersions, Menus, MenuItems, BlogCategories, BlogPosts, FAQs, HomepageSections, Banners, MediaLibrary, SEOSettings, EmailTemplates, LegalDocuments (+acceptance)

---

# NOTIFICATIONS

Notifications, NotificationTemplates (locale, version), NotificationPreferences, EmailLogs, SMSLogs, PushLogs, PushSubscriptions, WhatsAppLogs, OtpChallenges

---

# SUPPORT

SupportTickets (category, routing, SLA timers), TicketReplies, TicketAttachments, TicketCsat, KnowledgeBaseArticles, AiSupportTranscripts

---

# ANALYTICS

SearchAnalytics, TrafficAnalytics, ConversionAnalytics, SalesAnalytics, VendorAnalytics, CustomerAnalytics, AnalyticsEvents (first-party event log; `event_id` for server-side pixel dedupe), BotTrafficLogs (AI crawler tracking)

---

# PLATFORM / INFRASTRUCTURE (new)

PlatformSettings (typed key/value, audited), FeatureFlags, OutboxEvents (transactional outbox: id/event_id, type, schema_version, payload, status, attempts, next_attempt_at; unique event_id), IdempotencyKeys (key, endpoint, request_hash, response, expires_at), JobRuns (scheduler/worker audit), WebhookEndpoints (outbound subscriptions, Phase 2), AdminStepUpChallenges

---

# AUDIT

AuditLogs (append-only: actor, role, action, entity, before/after (redacted), ip, user_agent, request_id, correlation_id, result), ActivityLogs, SystemLogs (retention-limited)

---

# DATABASE RULES (summary)

UUID v7 primary keys; foreign keys; soft deletes; CreatedAt/UpdatedAt/DeletedAt; audit tracking; optimized indexing; ACID transactions; RLS default-deny on all tables; append-only ledgers (Transactions, InventoryTransactions, OrderStatusHistory, RewardPoints, GiftCardTransactions, SocialPostDeliveryAttempts, AuditLogs, WebhookEvents); migration-driven changes with expand/contract for zero-downtime (add nullable → backfill → enforce → drop later).

# SEED / REFERENCE DATA

See 08 §21. Seeds are idempotent, environment-guarded, and never insert demo users in production.
