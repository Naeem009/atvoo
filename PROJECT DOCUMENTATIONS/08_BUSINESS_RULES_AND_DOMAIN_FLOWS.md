# BUSINESS RULES AND DOMAIN FLOWS

Companion spec to 01–07 and 09. This document removes domain ambiguity: every rule below is a **resolved default** that Cursor implements as written. Numeric values are **admin-configurable platform settings** (§20) seeded with the defaults shown — never hardcoded in code. Items marked **[SIGN-OFF]** need business/legal/finance approval before production use with real money or regulated data; they are still built now behind settings/flags.

## 0. Market and locale assumptions (change via settings, never hardcode)

| Setting | Default | Notes |
|---|---|---|
| Primary market | Pakistan | Inferred from competitor set (Daraz/Noon) and operator location. **Confirm.** All country-specific rules below are data (settings/tables), not code branches. |
| Base currency | PKR (ISO 4217) | Prices stored as integer minor units (`bigint`), currency code on every money column. No floats for money. |
| Display/multi-currency | PKR only at launch; schema multi-currency-ready (`Currencies`, `ExchangeRates`) | |
| Languages | English at launch; i18n-ready (`next-intl`, message catalogs, ICU); Urdu + RTL layout in Phase 2 | Content tables carry `locale`. |
| Timezone | Platform `Asia/Karachi`; all timestamps stored UTC; users/vendors have timezone for display and scheduling | |
| Phone/address | E.164 phone; address fields: name, phone, line1, line2, city, province/state, postal code (optional), country; city list seeded | |
| Units | Metric (kg, cm) | |

## 1. Accounts, authentication and sessions

- Registration: email + password (or Google login), phone optional but required for COD orders. Email verification required before checkout and before vendor actions; verification link TTL 24h, single use.
- Password: ≥ 10 chars, checked against a breached-password list (k-anonymity API or local list), hashed with Argon2id (bcrypt only if Argon2 unavailable). No composition rules beyond length; no forced rotation.
- Lockout/throttle: 5 failed logins/15 min per account+IP → progressive delay + CAPTCHA (Cloudflare Turnstile). Registration, login, forgot-password, contact and review forms protected by Turnstile.
- Tokens: access JWT 15 min; refresh token 30 days, **rotating**, stored hashed in `RefreshTokens`, reuse detection revokes the whole family. Refresh cookie `HttpOnly; Secure; SameSite=Lax`; access token kept in memory; CSRF double-submit token for cookie-authenticated mutations.
- Sessions/devices: list and revoke devices (`Devices`, `Sessions`). Password change revokes all sessions.
- 2FA-ready: TOTP enrolment for vendor owners, finance, admin and super-admin — **mandatory for admin/finance/super-admin roles from launch**; recovery codes; step-up auth for payouts, role changes and settings changes.
- Account deletion/export (privacy): self-service request; anonymise PII, retain legally required financial/audit records (§19).
- Guest checkout allowed (email + phone), with optional account creation after order.

## 2. Vendor lifecycle

States: `APPLIED → DOCUMENTS_PENDING → UNDER_REVIEW → APPROVED | REJECTED`; `APPROVED → SUSPENDED → APPROVED`; `APPROVED → TERMINATED`.

- Application collects: legal name, trading name, entity type, CNIC/NTN/registration number (per country settings), contact, bank account (name must match legal name), pickup address, categories, documents (ID, business proof, bank proof) stored in a **private** Supabase bucket (`vendor-docs`), never public, signed URLs ≤ 5 min, access logged.
- Admin verifies documents (checklist), may request resubmission with note. Approval requires: all mandatory docs verified, bank details verified (micro-deposit or letter), agreement accepted (versioned `VendorAgreements`, acceptance stored with IP/timestamp).
- New vendors start on the **Free/Starter plan** with a probation limit: max 50 active listings, payout hold extended (+7 days) for the first 30 days / first 20 orders. Settings.
- Suspension triggers (auto-flag, admin decides): defect/late-ship rate above threshold, counterfeit report upheld, policy violation, chargeback ratio > 1%. Suspended = listings hidden, no new orders; open orders must complete; payouts held pending review.
- Vendor staff: roles `VENDOR_STAFF` with scoped permissions (catalog, orders, inventory, social). Owner only: payouts, bank details, plan, staff management.

## 3. Catalog rules

- **Taxonomy:** admin-managed category tree (max depth 4), each category defines: required attributes, allowed/required GTIN, size/variant axes, tax class, commission override, return-window override, restricted flag (needs admin pre-approval), age-restricted flag.
- **Seed taxonomy** (launch): Electronics, Mobiles & Accessories, Fashion (Men/Women/Kids), Home & Kitchen, Beauty & Personal Care, Health & Wellness, Groceries, Sports & Outdoors, Toys & Baby, Automotive, Books & Stationery, Jewelry & Watches, Pets, Office & Industrial. Details in seed file `taxonomy.seed.json`.
- **Prohibited items list** (`ProhibitedItemRules`): weapons/ammunition, illegal drugs, prescription medicines (unless licensed vendor, **[SIGN-OFF]**), counterfeit goods, stolen goods, adult content, hazardous materials, wildlife products, tobacco/alcohol (per local law), recalled products, hate/extremist items. Keyword + category rules block at submission; reports escalate to admin.
- **Product fields (required for ACTIVE):** title (10–150 chars), description (≥150 chars), category, brand (or "Unbranded"), ≥ 1 image (≥ 800×800, ≤ 5 MB, JPEG/PNG/WebP), price > 0, stock ≥ 0, SKU (unique per vendor), condition (`NEW|USED|REFURBISHED`), weight (g) + dimensions (cm) for shippable goods, shipping profile, return policy (inherited unless bounded override), GTIN/UPC/EAN/ISBN where category requires, country of origin (optional).
- **Variants:** up to 3 option axes (e.g., color/size/material), ≤ 100 variants/product; each variant has own SKU, price, compare-at price, stock, weight, images (optional), GTIN. Variants are **never hard-deleted** once ordered; retire by `status = ARCHIVED`.
- **Slug:** `kebab(title)-shortid`, immutable after publish; title change keeps slug; slug change creates `SlugRedirects` 301.
- **Quality score (0–100)** computed on save: required fields, image count/size, description length, attributes filled, GTIN presence, reviews. Products < 60 cannot be `is_eligible_search` for external feeds; shown in vendor dashboard with fix hints.
- **Approval (08 §3 is the single definition):** vendor submit → automated checks (prohibited keywords, image validity, duplicate detection by GTIN/title similarity/image hash, price sanity vs. category median ×0.2–×5) → `AUTO_APPROVED` for vendors with trust level ≥ 2 and no flags, else `PENDING_REVIEW` for admin. Admin approve/reject with reason from a reason list. SLA for manual review: 24h business.
- **Bulk operations:** CSV/XLSX template import (create/update), export, bulk price/stock update; import runs as background job with row-level error report; max 5,000 rows/file; images via URL fetch (SSRF-protected, allowlist of schemes, size/time caps) or ZIP.
- **Duplicate listings:** same GTIN by multiple vendors → grouped as **offers on one canonical product page** (Phase 2); at launch, same GTIN allowed but flagged.
- **Media:** images stored in Supabase Storage (`product-media`), originals preserved, derivative sizes via Storage transformations; alt text auto-generated from title + variant, editable; videos: link (YouTube/Vimeo) or upload ≤ 100 MB MP4 (Phase 2 upload).

## 4. Pricing, tax and currency

- Price = `price` (selling) with optional `compare_at_price` (must be > price to show discount). Discount % shown only if compare-at ≥ price × 1.05 and the product has been listed at compare-at price or higher in the last 30 days (anti-fake-discount rule).
- Tax: `TaxClasses` + `TaxRates` per (country, province, class). Default display **tax-inclusive**; invoices itemise tax. Tax engine interface supports inclusive/exclusive; **[SIGN-OFF]** final tax treatment (GST/sales tax, withholding on vendor payouts) by accountant before launch.
- Platform fee/commission calculated on item subtotal after discounts, excluding shipping and tax (unless category override).
- Rounding: round half up to minor unit per line, then sum.
- Flash sale: `FlashSales` with start/end, per-product sale price, stock cap, per-customer limit; price resolved server-side at cart/checkout time; countdown UI only reflects server time.

## 5. Cart

- Guest cart keyed by `X-Cart-Session` (UUID in cookie, 30-day TTL); merged into user cart on login (sum quantities up to stock/limits).
- Max 50 line items, qty per line ≤ min(stock, product max-per-order (default 10)).
- Cart never reserves stock; **checkout start creates `StockReservations` (TTL 15 min)** extended once on payment redirect (max 30 min). Expired reservations released by a job (every minute). Reservation releases on payment failure/cancel.
- Prices re-validated at every cart read and at order creation; price/stock changes surface as visible line warnings, never silent.
- Cart is grouped by vendor for display with a combined total (one Order, 08 §8).

## 6. Search eligibility, listing and feeds

A product is **publicly visible** iff: product `status = ACTIVE`, `approvalStatus = APPROVED`, vendor `APPROVED` and not suspended, category active, ≥ 1 sellable variant (active and stock > 0 OR backorder allowed), not soft-deleted.
Product is **external-feed eligible** (`is_eligible_search`) iff publicly visible AND quality score ≥ 60 AND all required feed fields present AND vendor opt-out flag false. Out-of-stock products stay on the site (availability `OutOfStock`), are `out_of_stock` in feeds, and are excluded from social automation.

## 7. Inventory

- `Inventory` per (warehouse, variant); `available = on_hand − reserved`. Every movement writes an `InventoryTransactions` row (reason: RESTOCK, SALE, RETURN, ADJUSTMENT, RESERVATION_RELEASE, DAMAGE, TRANSFER) with actor and reference.
- Oversell protection: stock decrement uses a conditional atomic update (`WHERE available >= qty`); failure aborts checkout line.
- Low-stock alert at threshold (default 5) → vendor notification + `LowStockAlerts`; back-in-stock event drives wishlist/product alerts and social triggers.
- Backorder: optional per variant (`allow_backorder`, max backorder qty, lead-time days shown).
- Multi-warehouse allocation at order time: pick the warehouse with highest available that can fulfil fully; split only if vendor enables it.

## 8. Orders, payments and fulfilment

### 8.1 Structure
One buyer-facing `Order`; `OrderItems` carry `vendorId`; one `Shipment` per (order, vendor). No separate "VendorOrder" table. Order number format: `ATV-{YYMM}-{base36 sequence 6}`; human-readable, non-guessable public tracking token separate from internal id.

### 8.2 Order status (buyer-facing, on `Order`)
`PENDING_PAYMENT → PAID | COD_CONFIRMED → PROCESSING → PARTIALLY_SHIPPED → SHIPPED → PARTIALLY_DELIVERED → DELIVERED → COMPLETED`; terminal/side: `CANCELLED`, `FAILED_PAYMENT`, `REFUND_PENDING`, `REFUNDED`, `PARTIALLY_REFUNDED`.
Derived from Shipment statuses; transitions validated by a state machine service; every change appends `OrderStatusHistory` (actor, reason, timestamp). `COMPLETED` = delivered + return window elapsed.

### 8.3 Shipment status (vendor-controlled, on `Shipment`)
`PENDING → PACKED → HANDED_TO_CARRIER → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`; exceptions: `DELIVERY_FAILED`, `RETURNING`, `RETURNED`, `LOST`.
Vendor SLA: ship within **2 business days** of confirmation (setting); late shipments auto-flag, 3 breaches/30 days → vendor warning. Order auto-cancels (and refunds) if unshipped after 7 days (setting) unless vendor requests extension.

### 8.4 Payment methods and states
- **Methods (launch):** Cash on Delivery (COD), card (Stripe or local acquirer **[SIGN-OFF]** on provider availability for the entity), JazzCash, Easypaisa, bank transfer (manual verification, Phase 2). Wallet/gift-card/loyalty-points as partial tenders.
- **PCI scope:** card data never touches ATVOO servers — hosted fields/redirect only (SAQ A). No PAN in logs, DB, n8n or analytics.
- Payment states: `INITIATED → AUTHORIZED → CAPTURED | FAILED | CANCELLED`; refunds `REFUND_PENDING → REFUNDED | REFUND_FAILED`; disputes `DISPUTE_OPEN → WON | LOST`.
- Webhooks: signature-verified, idempotent by provider event id; orders move to PAID only on verified webhook/server-side confirmation, never on client redirect alone. Reconciliation job daily compares provider settlement vs. `Transactions`; mismatches → admin alert.
- **COD rules:** limits per order (default min PKR 500, max PKR 50,000), per customer unconfirmed COD cap (3 open), phone verification by OTP (SMS/WhatsApp) before dispatch for first-time customers, COD fee setting (default PKR 0–100), city eligibility list, auto-block after 2 refused deliveries (RTO). COD cash is collected by carrier and remitted → recorded as `CARRIER_REMITTANCE` transactions; escrow release for COD follows remittance confirmation. **[SIGN-OFF]** COD reconciliation procedure with chosen carriers.

### 8.5 Checkout flow (server-enforced)
1. Validate cart, addresses, shipping method per vendor group, coupon, payment method.
2. Create `Order` + `OrderItems` + `Shipments` + `StockReservations` in one DB transaction with `Idempotency-Key`.
3. Initiate payment (or COD confirmation). Webhook confirms.
4. On PAID/COD_CONFIRMED: decrement stock (convert reservations), create `EscrowHoldings` per shipment, generate invoice (`Invoices`, sequential number per fiscal year, PDF stored in private bucket), emit outbox events (`order.placed`, `inventory.changed`), send notifications.
5. Guest orders are accessible via order number + email/phone token.

## 9. Shipping

- **Launch model (resolved):** vendor-fulfilled shipping with **vendor-defined `ShippingProfiles`** (zones by province/city, rate type: flat / free-over-threshold / weight-based, handling days, transit days, carrier name, COD allowed). Vendor enters carrier + tracking number at `HANDED_TO_CARRIER`. Platform shows delivery estimate = handling + transit days (business days, holiday calendar setting).
- **Phase 1.5:** carrier adapter interface `CarrierAdapter { quote, createShipment, label, track, cancel, codRemit }` with adapters for local couriers (TCS, Leopards, PostEx, Trax, BlueEx/M&P) selected per **[SIGN-OFF]** contracts; webhook/polling tracking updates `ShipmentTracking`. Adapters are optional per vendor.
- Platform-level shipping policy template (08 §10) inherited by vendors; bounded deviations (handling ≤ 5 days, transit per zone) disclosed on product page.
- Free-shipping threshold (platform promo) funded by platform or vendor per campaign setting.
- Address validation: required fields, city from list, phone format; saved addresses ≤ 10.

## 10. Returns, refunds and policies

- Platform policy templates (editable CMS pages, versioned): Shipping, Return, Refund, Privacy, Terms. Vendors inherit; may offer **stricter-for-vendor** (longer window) but not shorter than platform minimum.
- Return window default **7 days from delivery** (category override: electronics 7, fashion 14, hygiene/perishables/digital: non-returnable except defect/wrong item).
- Eligible reasons: defective/damaged, wrong item, not as described, size/fit (category-dependent), changed mind (category-dependent, buyer pays return shipping).
- Flow: `RETURN_REQUESTED → APPROVED | REJECTED → ITEM_SHIPPED_BACK → RECEIVED → INSPECTED → REFUND_APPROVED | REFUND_REJECTED → REFUNDED`. Vendor responds within 48h or auto-approves for defect/wrong item with photo evidence; disputes escalate to platform (support agent decision final, SLA 3 business days).
- Refund methods: original payment method (card/wallet), store credit/wallet, COD refunds to wallet or bank transfer. Refund amount = item price + proportional tax (+ original shipping if vendor fault). Refund reverses vendor commission proportionally.
- Escrow interplay: refund before release reverses `EscrowHoldings`; after release creates negative adjustment on next payout (§11).
- Abuse controls: return rate per customer, serial-returner flag, refund-without-return threshold (default PKR 2,000 and trusted customers only).

## 11. Commission, escrow and payouts

(Implements handbook §0.2; finance/legal sign-off before real payouts.)

- **Commission:** default **10%** of item subtotal after discounts (category override table); vendor plan can reduce (Starter 12%, Growth 10%, Premium 8% — plan table setting); payment-processing fee passed through at cost, shown in statements.
- **Escrow:** captured funds per shipment held `HELD`; release when shipment `DELIVERED` + return window elapsed (default 7 days) + no open dispute/return; COD follows carrier remittance. Manual release/reverse by finance role (step-up auth, audit-logged).
- **Payout batches:** weekly (Mondays, setting), min payout PKR 1,000 (rolls over), new-vendor probation holds (§2). Payout = released escrow − commission − fees − refunds/adjustments − chargebacks. Payout statement PDF per batch. Bank transfer file/export for finance; payout provider API optional later.
- **Tax on payouts / vendor invoices:** per accountant **[SIGN-OFF]**.
- **Subscriptions:** `Plans` (Starter free, Growth, Premium, Enterprise) with price, billing interval (monthly/annual), included entitlements (handbook §1.2.2 keys), listing limits, commission rate; billed from payout offset or card; dunning: grace 7 days → downgrade to Starter (SMAE §43 downgrade rules apply).
- **Sponsored products/vendors/homepage ads:** `AdPlacements` + `AdCampaigns` (CPC or fixed-fee flat per period), clearly labelled "Sponsored", never alters organic ranking data, budget cap, daily spend limit; Phase 2 build, schema reserved.

## 12. Promotions, loyalty and referrals

- **Coupons:** types `PERCENT`, `FIXED`, `FREE_SHIPPING`, `BUY_X_GET_Y` (P2); scope platform/vendor/category/product; min cart value, max discount, per-user and global usage limits, start/end, first-order-only, stackable flag (default: **one coupon per order**, platform coupon + vendor coupon may combine only if both flagged stackable). Vendor-funded vs platform-funded recorded; commission calculated on post-discount amount.
- **Gift cards:** purchasable, 16-char random code (CSPRNG) + PIN, balance ledger (`GiftCardTransactions`), expiry 12 months (setting), no cash-out, not refundable to cards (refund to gift-card balance), fraud limits per day.
- **Loyalty points:** earn **1 point per PKR 100** of paid item subtotal (setting), credited when order `COMPLETED`; redeem 1 point = PKR 1 (setting) up to 20% of order; points expire after 12 months inactive; reversed on refund. Ledger is append-only (`RewardPoints`).
- **Referrals:** referrer and referee each get a coupon/points after referee's first `COMPLETED` order (setting amounts); self-referral and same device/address/payment blocked.
- **Affiliates:** referral link `?aff=CODE`, first-party cookie 30 days (last-click wins), commission default 5% of net item subtotal on `COMPLETED` orders, 30-day approval hold, payout threshold PKR 2,000, self-purchase excluded, coupon-stealing/brand-bidding rules in affiliate terms; tracked via `AffiliateCommissions`.
- **Memberships (premium):** schema reserved; Phase 2.

## 13. Reviews, Q&A and trust

- Reviews only from **verified purchasers** after `DELIVERED`; one review per order item; rating 1–5, title, body (20–2,000 chars), up to 5 photos / 1 video. Edit window 30 days. Auto-moderation (profanity, PII, links, spam, duplicate) → `PUBLISHED` or `PENDING`; vendors may reply once, cannot delete; report-abuse flow; verified badge; helpful votes (`ReviewVotes`, one per user).
- Incentivized reviews must be disclosed; points for reviews allowed only for review submission (not for positive rating).
- Q&A: logged-in users ask; vendor or staff answers within 72h; community answers allowed with badge.
- Vendor score (0–100): fulfilment rate, on-time ship rate, cancellation rate, review average, response time, return/dispute rate; shown as badges (Top Rated ≥ 85 w/ ≥ 50 orders).
- Report listing/review/vendor → `Reports` queue with SLA 24h.

## 14. Support and disputes

- Ticket categories route automatically: `ORDER_VENDOR_ISSUE → vendor first (48h) then platform`, `PAYMENT/REFUND → finance`, `ACCOUNT/TECH → support`, `ABUSE/SAFETY → trust & safety`. Priority by order value/age/SLA. First response SLA 24h, resolution 3 business days (settings). Attachments private bucket, virus-scanned (handbook §9.9). Canned replies. CSAT survey on close.
- AI customer support assistant (Phase 1.5): answers from knowledge base/order status via tools, escalates to human; never promises refunds, never exposes other users' data; transcripts retained 90 days.

## 15. Notifications (event → channels)

Provider interface per channel: email (Resend), SMS (local aggregator **[SIGN-OFF]**), WhatsApp Business (templates, opt-in), push (web push/FCM). Preferences per user; transactional messages always sent; marketing requires opt-in; unsubscribe link; quiet hours for marketing (21:00–09:00 local).

| Event | Customer | Vendor | Admin |
|---|---|---|---|
| Account verify/reset | email | email | – |
| Order placed / paid | email, push, WA | email, push | – |
| COD confirmation OTP | SMS/WA | – | – |
| Shipped / out for delivery / delivered | email, push, WA | – | – |
| Cancellation / refund | email, push | email | finance alert (large) |
| Return requested/approved/received | email | email, push | – |
| New order / low stock / listing approved/rejected | – | email, push | – |
| Payout processed | – | email | – |
| Vendor application received/decision | – | email | queue |
| Review posted / question asked | – | email, push | – |
| Price drop / back-in-stock (wishlist, alerts) | email, push | – | – |
| Abandoned cart (1h, 24h, 72h; max 3; opt-in for marketing channels) | email/push | – | – |
| Security (new device login, password change) | email | email | – |
| Social post failed/needs approval/reauth | – | email, push | – |
| Feed rejections, DLQ growth, payment mismatch | – | – | email, Slack/webhook |

Templates stored in `NotificationTemplates` (CMS-editable, versioned, locale-aware), rendered server-side, every send logged (`EmailLogs`, etc.) without sensitive payloads.

## 16. Search, discovery and recommendations

- Search: PostgreSQL FTS (`tsvector` weighted: title A, brand/category B, description/attributes C) + `pg_trgm` typo tolerance + synonyms table; filters (category, brand, price range, vendor, rating, availability, attributes, shipping/COD eligibility); sorts (relevance, price asc/desc, newest, rating, best-selling); autosuggest from popular queries + product titles (min 2 chars, debounce 200ms, p95 < 150 ms); zero-result queries logged and surfaced to admin. Semantic/vector search (text embeddings in pgvector) blends into relevance as Phase 1.5 (hybrid rank fusion).
- Sponsored items labelled and capped (max 1 in 5 results).
- Recommendations (launch rules-based, then ML): "related" (same category + attribute similarity + co-view), "frequently bought together" (order co-occurrence), "recommended for you" (recent views/purchases + trending fallback), "recently viewed". Cold-start fallback: best sellers by category. No personal-data leakage across users.
- Trending/Best sellers/New arrivals/Top rated computed by scheduled jobs (windows 7/30 days) into `HomepageSections` caches.

## 17. Fraud and risk

Rules (score + action): velocity per IP/device/card, new account + high value, mismatched billing/shipping country, repeated COD refusal, multiple accounts on same device, disposable email, vendor self-purchase (blocked), review rings. Actions: allow, step-up (OTP/3-DS), hold for manual review, block. Admin queue with reason codes; all decisions logged. Chargeback handling workflow with evidence pack from order/shipment/tracking data.

## 18. Analytics and tracking (consent-aware)

- Consent banner (cookie categories: necessary, analytics, marketing) with stored `ConsentRecords`; no analytics/marketing tags before consent where law requires (Google Consent Mode v2 signals).
- Client + **server-side** events: `page_view`, `view_item`, `search`, `view_item_list`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `refund`, `sign_up`, `login`, `share`, `social_click` with `utm_*`. GA4 + Meta Pixel + Meta Conversions API + TikTok pixel/Events API (server-side from API with event_id dedupe) behind consent.
- First-party analytics tables (08 → 02 "Analytics") are the system of record; dashboards read them.

## 19. Privacy, legal and data retention

- Pages required before launch (versioned, CMS): Terms, Privacy, Cookie, Shipping, Return, Refund, Seller Agreement, Affiliate Terms, Acceptable Use, Intellectual-property/takedown (DMCA-style) procedure, Contact/Grievance officer. **[SIGN-OFF]** lawyer review for operating jurisdiction.
- Rights handling (access/export/delete/correct) within 30 days; deletion = anonymise personal fields, retain orders/invoices/audit for statutory period (default 7 years), documented in a retention table. Backups age out per policy.
- Data classification: PII (name, phone, address, email), financial, credentials/tokens, vendor documents; encryption at rest (Supabase), column-level encryption for OAuth tokens and bank details (`pgcrypto`/app-level with `SOCIAL_ENCRYPTION_KEY`-style keys), TLS everywhere, logs scrubbed.
- Vendor-uploaded content licence grant for promotion (incl. social + AI-generated derivatives) in Seller Agreement; vendor warrants IP ownership.
- Children: platform is 18+ for account creation (or guardian-supervised per local law); no marketing to minors.
- Social/AI compliance per 06 §41–§45; AI disclosure labels where platforms require.

## 20. Platform settings catalogue (all defaults above; `PlatformSettings` key/value, typed, audited, cached)

Commerce: `currency.default`, `tax.display_inclusive`, `commission.default_rate`, `commission.by_category`, `order.min_value`, `cart.max_items`, `cart.max_qty_per_line`, `stock.reservation_ttl_min`, `ship.sla_business_days`, `ship.auto_cancel_days`, `return.window_days`, `return.vendor_response_hours`, `escrow.release_delay_days`, `payout.schedule`, `payout.min_amount`, `payout.probation_hold_days`, `cod.enabled`, `cod.min/max_amount`, `cod.fee`, `cod.open_orders_cap`, `loyalty.earn_rate`, `loyalty.redeem_rate`, `loyalty.expiry_months`, `affiliate.rate/cookie_days/hold_days`.
Trust & content: `product.review_sla_hours`, `product.auto_approve_trust_level`, `quality.min_feed_score`, `review.edit_window_days`, `crawler.policy`, `fraud.*` thresholds.
Feature flags (`FeatureFlags`): `payouts.release_job_enabled` (finance/legal flag), `agent.checkout_enabled`, `agent.ucp_enabled`, `agent.mcp_enabled`, `social.vendor_automation_enabled`, `social.store_channel_enabled`, `social.<platform>.enabled`, `visual_search.enabled`, `ai.support_enabled`, `maintenance.mode`.
Every settings change: permission `settings:write`, step-up auth for financial keys, audit log with before/after.

## 21. Seed and reference data (shipped with migrations/seed, versioned)

Roles+permissions, plans+entitlements, taxonomy, attribute templates per category, cities/provinces, banks, carriers, return reasons, report reasons, prohibited-item rules, notification templates, policy page drafts (placeholders marked **DRAFT – LEGAL REVIEW**), email layouts, default homepage sections, default platform settings, feature flags (all risky flags OFF).
