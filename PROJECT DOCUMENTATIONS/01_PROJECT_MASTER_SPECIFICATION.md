# PROJECT MASTER SPECIFICATION

## Project Name

ATVOO — "AI-Based Most Modern Shopping Store"

Revision 2: cleaned markdown, added launch scope, success metrics, LLM discoverability objective, assumptions and cross-references to specs 08–09. All original content is retained.

---

# 1. PROJECT VISION

Build a world-class, enterprise-grade, AI-ready, SEO-optimized Multi-Vendor Marketplace Platform capable of competing with Amazon, Etsy, Shopify Plus Marketplaces, Alibaba, Daraz, Noon, and Temu.

The platform shall support:

- B2C Commerce
- Multi-Vendor Marketplace
- Social Commerce
- Mobile Commerce
- AI Commerce
- AI Agent Commerce (ChatGPT, Perplexity, Gemini and other AI shopping agents)
- Visual Search Commerce
- Future B2B Expansion

**Discoverability objective (new, binding):** ATVOO products must be readily findable, citable and recommendable in LLM answers (ChatGPT, Gemini/AI Mode, Perplexity, Claude, Copilot) and classic search from day one. This is a launch requirement, specified in 07 Part 1.

---

# 2. BUSINESS OBJECTIVES

Primary Objectives: product sales; vendor onboarding; marketplace commissions; customer retention; loyalty ecosystem; affiliate ecosystem.

Revenue Streams: commission on sales; vendor subscriptions; sponsored products; sponsored vendors; homepage advertising; affiliate commissions; gift cards; premium memberships; Social Media Automation Add-on (tiered, per vendor).

## 2.1 Success metrics (targets; reviewed at T+30/T+90)

| Metric | Target |
|---|---|
| Checkout conversion (sessions→orders) | ≥ 1.5% at T+90 |
| Vendor activation (approved vendors with ≥ 1 sale in 30 days) | ≥ 60% |
| On-time shipment rate | ≥ 92% |
| Return/dispute rate | ≤ 8% |
| Chargeback ratio | < 1% |
| Search→click rate | ≥ 60% |
| AI-surface visibility (prompt-panel mention/citation rate on branded + category prompts) | tracked weekly, trend up |
| Share of orders attributed to AI agents/LLM referrals | tracked; no fixed target at launch |
| Core SLOs | availability 99.9%, see 09 §7 |

## 2.2 Launch scope (resolved)

| Tier | Scope |
|---|---|
| **Launch (must work at go-live)** | Public site, customer portal, vendor portal, admin portal; catalog, search (FTS), cart, checkout (card, COD, JazzCash/Easypaisa), orders/shipments, returns/refunds, escrow-based payouts (flagged), reviews/Q&A, coupons, loyalty, basic affiliates, CMS, notifications, support tickets, analytics + consent; LLM discoverability (07 Part 1) with Google/Bing/OpenAI/Perplexity feeds, discovery-only UCP profile, MCP server; Social automation Mode A (Meta first) + Mode B store channel; visual search; AI recommendations (rules-based) and AI-assisted content; PWA |
| **Phase 1.5** | Carrier API adapters, AI support assistant, semantic hybrid search, Pinterest/X/TikTok adapters, UCP catalog endpoints |
| **Phase 2** | Agentic checkout (UCP/ACP), Urdu/RTL, sponsored ads engine, memberships, canonical multi-vendor offers, native mobile apps (customer/vendor), B2B |

Anything in a later tier ships disabled behind a feature flag if partially built (08 §20).

## 2.3 Assumptions (change via settings, not code)

Primary market Pakistan, base currency PKR, English at launch (08 §0). COD is a first-class payment method. Vendor-fulfilled shipping at launch (08 §9).

---

# 3. PLATFORM MODULES

```text
Marketplace Platform
├── Public Website
├── Customer Portal
├── Vendor Portal
├── Admin Portal
├── CMS
├── Marketing Automation
├── Social Media Automation Engine (Vendor Premium Add-on + Marketplace channel)
├── AI Agent Commerce Layer (feeds, UCP profile, MCP, protocols for ChatGPT/Perplexity/Gemini)
├── LLM & Search Discoverability (SEO/GEO)
├── Visual Search Engine
├── Loyalty System
├── Affiliate System
├── Inventory Management
├── Finance Management (payments, escrow, payouts, tax, invoices)
├── Shipping & Fulfilment
├── Search Engine
├── AI Recommendation Engine
├── Analytics System
├── Notification System
├── Fraud & Risk
├── API Gateway
└── Mobile Applications
```

---

# 4. USER TYPES

Guest Visitor; Customer; Vendor Owner; Vendor Staff; Affiliate Partner; Support Agent; Inventory Manager; Marketing Manager; Finance Manager; Administrator; Super Administrator. (Permissions: handbook §1.2.1; entitlements: §1.2.2.)

---

# 5. WEBSITE HIERARCHY

Homepage; Shop; Categories; Brands; Vendor Stores; Deals; Flash Sale; Daily Deals; Clearance; Seasonal Offers; New Arrivals; Best Sellers; Trending Products; Top Rated; Gift Cards; Referral Program; Track Order; Blog; Help Center; Support Center; About Us; Contact Us; FAQ; Careers; Privacy Policy; Terms & Conditions; Shipping Policy; Return Policy; Refund Policy; **Cookie Policy; Seller Agreement; Affiliate Terms; IP/Takedown Policy** (added, 08 §19).

---

# 6. CORE CUSTOMER FEATURES

Authentication; Social Login; Product Search; Wishlist; Compare; Reviews; Questions & Answers; Coupons; Gift Cards; Reward Points; Saved Payment Methods (tokenised only); Order Tracking; Returns; Refund Requests; Support Tickets; Notifications; Cash on Delivery; Address book; Privacy controls (export/delete).

---

# 7. CORE VENDOR FEATURES

Vendor Registration; Store Verification (KYC); Store Management; Product Management (single + bulk CSV); Inventory Management; Order Management; Shipping Management; Marketing Tools; Store Analytics; Customer Engagement; Vendor Staff Accounts; Payout Management (escrow view, statements); Subscription/Plan management; Social Media Automation (Premium Plans — opt-in, per platform).

---

# 8. CORE ADMIN FEATURES

Vendor Management; Customer Management; Product Management (approval queue); Order Management; Finance Management (escrow, payouts, reconciliation); CMS Management; Marketing Management; Report Management; Settings Management (08 §20); Feature Flags; Role Based Access Control; Audit Logs; Fraud Review Queue; Feed/Agent Commerce dashboard.

---

# 9. CMS FEATURES

Pages; Blogs; FAQs; Menus; Homepage Builder; Banner Management; Media Library; SEO Management; Email Templates; Landing Pages; Policy page versioning.

---

# 10. AI FEATURES

AI Search; AI Product Recommendations; AI Product Comparison; AI FAQ Generation; AI Review Summaries; AI Vendor Recommendations; AI Customer Support; AI Social Media Post Generation (captions, hashtags, best-time-to-post); Semantic Search; Vector Search; Visual Search (image-to-product); Knowledge Graph; AI Agent Discoverability (ChatGPT / Perplexity / Gemini shopping surfaces).

**AI governance (binding):** AI output is untrusted until validated against authoritative ATVOO data; per-feature cost budgets and kill switches; AI-generated content is provenance-tagged (06 §44); no AI feature may expose personal data across users.

---

# 11. MOBILE APPLICATIONS

Customer Application; Vendor Application; Progressive Web App (PWA — **launch**); Push Notifications; Offline Mode; Dark Mode; Biometric Login. Native apps are Phase 2; the PWA is the launch mobile experience.

---

# 12. NON-FUNCTIONAL REQUIREMENTS

Availability 99.9%; Page Load Time < 2 s; Desktop PageSpeed > 95; Mobile PageSpeed > 90; WCAG 2.1 AA; Cloud Ready; Disaster Recovery Ready (RPO ≤ 5 min DB, RTO ≤ 4 h — 09 §9); Horizontal Scaling Ready; Security baseline per 05 and 09 §10; Privacy per 08 §19.

---

# 13. MARKET WEAKNESSES THIS SPEC IS DESIGNED TO ADDRESS

| Common Market Weakness | How ATVOO Addresses It |
|---|---|
| Disjointed vendor onboarding | Structured Vendor Registration → Store Verification pipeline with status tracking (08 §2) |
| Payment splitting / commission leakage | Payments, Transactions, VendorPayouts, EscrowHoldings — system of record (08 §11) |
| Ambiguous support ownership | Centralized Support Center with ticket routing rules and platform-wide policy templates (08 §14) |
| Inconsistent return/refund/shipping policies | Platform policy templates vendors inherit, bounded deviations (08 §10) |
| Counterfeit / fake listings | Store Verification, documents, scoring, report pipeline, approval gate (08 §2–3) |
| Fragmented multi-vendor orders | One buyer-facing Order; per-vendor Shipments underneath (08 §8) |
| Weak search/discovery | FTS + semantic/vector + visual search (08 §16, 07) |
| Mobile as afterthought | Mobile-first design, PWA at launch (03) |
| Not API-first / headless | Versioned REST + OpenAPI; agent protocols as channels (04, 07) |
| AI as bolt-on | AI recommendation, search, social, agent commerce as first-class modules |
| Invisible to AI assistants | LLM discoverability program (07 Part 1) |
| Cold-start problem | Curated 10–30 vendor launch cohort + Store Channel social automation from day one (09 §11) |

---

# 14. RELATED SPECIFICATIONS

- 02 Database Architecture; 03 UI/UX Design System; 04 API Architecture; 05 Development Standards
- 06 Social Media Automation Engine (vendor and store social automation)
- 07 AI Agent Commerce Readiness, LLM Discoverability & Visual Search
- 08 Business Rules and Domain Flows (resolved defaults for every domain rule)
- 09 Launch Readiness and Operations (approvals, infrastructure, SLOs, DR, go-live gate)
- 00 Developer Handbook (operational source of truth for setup, environments, process)
