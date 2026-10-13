# AI AGENT COMMERCE READINESS, LLM DISCOVERABILITY & VISUAL SEARCH

Companion spec to 01–06 and 08–09. Read alongside them before generating code for this module.
Revision 2 — corrects protocol paths/mechanics verified against current public specs (checked Oct 2026) and adds the full LLM/search discoverability program.

Scope:

- **Part 1 — LLM and search discoverability (GEO/SEO):** getting ATVOO products *found, cited and recommended* by ChatGPT, Gemini/Google AI Mode, Perplexity, Claude, Copilot and classic search. **This is the launch-critical part.**
- **Part 2 — AI agent commerce protocols (UCP, ACP/OpenAI feed, Perplexity, MCP):** structured, machine-readable catalog and (optionally) agent checkout.
- **Part 3 — Visual search.**

> Corrections vs. revision 1 (binding): (a) the UCP discovery document lives at **`/.well-known/ucp`**, not `/.well-known/commerce-manifest.json`; (b) the OpenAI/ChatGPT product feed is **pushed by the merchant** to an OpenAI-provided allow-listed endpoint (CSV/JSON, initial sample + daily snapshots), it is not pulled from a `/feeds/acp` URL; (c) OpenAI has de-emphasised standalone Instant Checkout in favour of discovery + merchant-owned checkout, so **agentic checkout is not a launch requirement**; (d) crawler access is controlled per user-agent (training vs. search vs. user-fetch are different bots).

---

# PART 1 — LLM AND SEARCH DISCOVERABILITY (LAUNCH-CRITICAL)

## 1.1 How LLMs find products (design assumptions)

1. **Crawled web index** (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Applebot): reads **server-rendered HTML + JSON-LD**. Most AI crawlers do **not execute JavaScript**. If product data is only client-rendered, it is invisible.
2. **Merchant-supplied feeds** (OpenAI Product Feed, Google Merchant Center, Bing Merchant Center, Perplexity merchant program): authoritative price/stock/shipping.
3. **Live fetchers** (ChatGPT-User, Claude-User, Perplexity-User): fetch a URL when a human asks. Usually ignore robots.txt by design; must be served fast and correctly.
4. **Agent protocols** (UCP `/.well-known/ucp`, ACP, MCP, A2A/agents.json): programmatic catalog access and checkout.
5. **Third-party signals**: reviews, brand mentions, Merchant/Business profiles, social profiles (`sameAs`).

## 1.2 Rendering rules (binding)

- Every public indexable page (home, category, brand, vendor store, product, blog, policy pages) is **server-rendered (SSR/ISR) and complete in the initial HTML** — title, H1, description, price, availability, variants summary, vendor, reviews summary, shipping/returns summary, breadcrumbs, canonical link, JSON-LD.
- Never gate core product facts behind client-side fetch, tabs that render on click, infinite scroll without paginated URLs, or login.
- ISR revalidate: product pages ≤ 5 minutes **plus on-demand revalidation** on price/stock/approval change (outbox event → `revalidateTag`). Category pages ≤ 15 min.
- HTTP semantics: 200 for live, **410** for permanently removed products, 301 for renamed slugs (keep a `SlugRedirects` table), proper 404 page, no soft-404s. `Cache-Control` + `ETag`/`Last-Modified` on pages and feeds.
- Core Web Vitals targets from 01 §12 apply (slow pages are crawled less and cited less).
- One canonical URL per product (`/products/{slug}`); variants are query/anchor states of the same URL with `canonical` pointing to the parent. Pagination uses real `?page=` URLs.
- `lang`, `hreflang` (when more than one locale), `og:*`, `twitter:*`, `og:image` per page.

## 1.3 Structured data (JSON-LD) — required blocks

| Page | Schema.org types | Required fields |
|---|---|---|
| Site-wide | `Organization` (+`sameAs` to every official social profile), `WebSite` with `SearchAction` | name, url, logo, contactPoint, sameAs |
| Product | `Product` + `Offer` (or `AggregateOffer` for variants) + `AggregateRating` + `Review` (only real, moderated reviews) + `Brand` + `MerchantReturnPolicy` + `OfferShippingDetails` | name, description, image[], sku, gtin/mpn (when exists), brand, offers.price, priceCurrency, availability (schema.org enum), itemCondition, url, seller, priceValidUntil |
| Category / listing | `CollectionPage` + `ItemList` + `BreadcrumbList` | |
| Vendor store | `Organization`/`Store` (seller) + `BreadcrumbList` | |
| FAQ / policy / help | `FAQPage` only where visible FAQ exists | |
| Blog | `Article` + `BreadcrumbList` | author, datePublished, dateModified |

Rules: JSON-LD must **match visible page content exactly** (price, stock, rating). Never mark up reviews that don't exist. Validate in CI with a schema validator (§1.10).

## 1.4 robots.txt policy (binding)

Goal: be **citable and shoppable** in AI answers; AI **training** is a business decision (default below allows search/citation, opts out of pure training crawlers). Training-bot policy is a setting in the admin panel, rendered into robots.txt at request time.

```text
# robots.txt (generated; default policy)
User-agent: *
Allow: /
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /vendor
Disallow: /admin
Disallow: /*?*sort=
Disallow: /*?*session=

# AI search / citation / user-fetch bots: ALLOW (required for LLM visibility)
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Applebot
Allow: /

# AI training bots: policy-controlled (default DISALLOW; admin may flip to Allow)
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: CCBot
Disallow: /

Sitemap: https://{APP_DOMAIN}/sitemap.xml
```

Bot names change; the list is data (`PlatformSettings.crawler_policy`), reviewed quarterly against vendor docs (OpenAI bots, Anthropic crawler docs, Perplexity bots, Google crawlers). **Do not block OAI-SearchBot, Claude-SearchBot, PerplexityBot or Googlebot at the CDN/WAF** — configure Cloudflare Bot Fight Mode / WAF with a verified-bot allowlist so legitimate AI crawlers are not challenged.

## 1.5 Sitemaps and change notification

- `/sitemap.xml` (index) → `sitemap-products-{n}.xml` (≤ 50,000 URLs each, with `lastmod` = real last change and `image:image` entries), `sitemap-categories.xml`, `sitemap-brands.xml`, `sitemap-vendors.xml`, `sitemap-blog.xml`, `sitemap-pages.xml`. Only canonical, indexable, active+approved products.
- **IndexNow** (Bing/Copilot and participating engines): on product create/update/delete/price/stock change, the outbox dispatcher pings IndexNow (batched, ≤ 10,000 URLs/call). Key file hosted at `/{indexnow-key}.txt`.
- **Google Search Console** and **Bing Webmaster Tools** verified (DNS TXT) for production domain; sitemap submitted. Owners recorded in the launch checklist (09).

## 1.6 `llms.txt` and machine-readable context

- `/llms.txt` (markdown, concise): brand description, what is sold, markets served/currencies, links to top categories, policy pages (shipping, returns, refund, privacy, terms), `/sitemap.xml`, `/.well-known/ucp`, MCP endpoint, contact. Plain language, no marketing fluff, no secrets.
- `/llms-full.txt`: extended version (category tree, top brands, FAQ answers, policy summaries). Regenerated nightly.
- Markdown twins: every product/category/policy page also available at the same URL + `.md` (or `Accept: text/markdown`) containing the facts only (name, price, availability, specs, shipping, returns, vendor, URL). Cheap, token-efficient context for LLM fetchers.
- Note: `llms.txt` is an emerging convention, **not a ranking guarantee** — structured data, crawlability and feeds are the primary levers. Build it (cheap) but don't rely on it.

## 1.7 Content quality for citation (what makes LLMs recommend a product)

- Unique, factual product titles and descriptions (no manufacturer copy-paste duplicated across vendors; admin "duplicate content" report flags near-duplicates).
- Required catalog fields per product for **search-eligible** status (enforced by the approval gate, 08 §6): title (≤150 chars), description (≥ 150 chars, ≤ 5,000), ≥ 1 image ≥ 800px, brand, category, price+currency, availability, SKU, GTIN/MPN where applicable, condition, weight/dimensions where shipping needs them, shipping + return policy resolved, vendor verified.
- Specs as **structured attributes** (Attributes/AttributeValues), not prose only — LLMs extract attribute/value pairs.
- Real reviews with verified-purchase flag; review summary (AI-generated summaries must cite only real review data).
- FAQ per product/category (AI-assisted drafting allowed, human-approved, factual).
- Comparison and "best X for Y" buying-guide content in the blog, internally linked to categories/products (answer-engine bait: question-shaped H2s with direct 2–3 sentence answers).
- Trust: About, contact with real business details, policies, visible vendor verification badge, HTTPS everywhere.

## 1.8 Feeds for search and shopping surfaces (launch scope)

| Surface | Mechanism | Phase |
|---|---|---|
| **Google Merchant Center** (free listings; Shopping/AI Mode/Gemini) | Scheduled feed fetch **or** Merchant API push; GTIN/identifier hygiene; `native_commerce`/agentic attributes when eligible | Launch |
| **Bing Merchant Center** (Copilot/Bing) | Feed import (same canonical data) | Launch |
| **OpenAI Product Feed** (ChatGPT shopping) | **Push** CSV/JSON to OpenAI allow-listed endpoint: initial sample for validation, then daily snapshots (plus on-change deltas if supported). Requires approved merchant application. `is_eligible_search` / `is_eligible_checkout` flags | Launch (apply early — lead time) |
| **Perplexity** | Merchant program: Google-Shopping-format feed | Launch |
| Meta Catalog (Facebook/Instagram Shopping) | Catalog feed / Commerce Manager | Phase 2 (tied to SMAE) |

Country/eligibility of each program varies. **Launch checklist item (09): confirm program availability for the operating country and business entity before building exporters for that surface.**

All exporters read the single **Product Data Layer**; no exporter has its own business logic (08 §6 defines eligibility).

Feed requirements: validation before publish (missing GTIN/brand, broken image URLs, price/currency mismatch, availability mismatch with live page), diff report, staleness alarm (feed older than 24h or price/stock mismatch rate > 1%), reject-log ingestion from Merchant Center API into admin dashboard.

## 1.9 Monitoring AI visibility

- Server log pipeline tags requests by AI user-agent; dashboard: crawl volume/status codes per bot, top pages fetched, 4xx/5xx for bots (target: bot 5xx < 0.1%).
- Referral attribution: `utm_source`/`Referer` patterns for chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai → `AgentOrderAttribution` + analytics (§Part 2).
- **Weekly prompt-panel test** (manual or scripted, 09 §10): 30–50 fixed buyer-intent prompts ("best <product> under PKR X", "where to buy <product> in <city>") run against ChatGPT, Gemini, Perplexity, Claude; record whether ATVOO is mentioned/cited, correctness of price/availability, and link target. Trend in admin report. Failures create backlog tickets.
- Run an agent-readiness scanner/validator on staging and production before each major release.

## 1.10 CI/automated checks (binding)

- JSON-LD validation on a fixture set of product/category/home pages (fail build on invalid or mismatched price/availability).
- Lighthouse CI budget (01 §12 targets) on home, category, product.
- Test that product HTML contains price, availability and JSON-LD **without JavaScript** (fetch with no-JS client).
- robots.txt, sitemap, llms.txt, `/.well-known/ucp` contract tests (status 200, content type, schema).
- Broken-link and canonical-consistency crawl on staging.

---

# PART 2 — AI AGENT COMMERCE PROTOCOLS

## 2.1 Protocols (verified state, Oct 2026)

**UCP — Universal Commerce Protocol** (Google + Shopify; large partner/Tech Council; live Jan 2026; spec version pinned **2026-04-08**, track `ucp.dev`). Merchant publishes a **discovery profile at `/.well-known/ucp`** (HTTPS required) declaring services, capabilities (e.g. `dev.ucp.shopping`, `…catalog`, checkout, order, identity linking), versions, transport (REST/MCP/A2A), signing keys (ECDSA P-256), payment handlers. Agents then call REST endpoints (e.g. catalog search, product detail, checkout sessions, order fetch). Merchant remains merchant of record; identity linking uses OAuth with authorization-server metadata at `/.well-known/oauth-authorization-server`.

**OpenAI — ChatGPT shopping feed + ACP:** product discovery runs on the **OpenAI Product Feed** (merchant pushes CSV/JSON; required: identifiers, title ≤150, description ≤5,000, price with ISO-4217 currency, availability, images, link, plus `is_eligible_search`/`is_eligible_checkout`; recommended: reviews, rich media, performance signals). Requires crawler access for **OAI-SearchBot** and, unless on Shopify/Etsy, an approved merchant application. **ACP** (OpenAI+Stripe; Agentic Checkout spec + Delegated Payment spec) defines checkout endpoints; OpenAI states it is moving toward discovery plus merchant-owned checkout. ACP capability discovery at `/.well-known/acp.json` where implemented.

**Perplexity Merchant Program:** Google-Shopping-format feed; checkout through partner rails; merchant stays merchant of record.

**MCP (Model Context Protocol):** UCP supports MCP as a transport; ATVOO also offers its own read-only public MCP server.

> Protocol specs move fast. Each integration pins a spec version in code (`UCP_SPEC_VERSION`, `ACP_SPEC_VERSION`), has contract tests, and is re-verified against the live spec every quarter and before enabling in production (09 §10).

## 2.2 Phasing (binding)

| Phase | Deliverable |
|---|---|
| **P0 — launch** | Part 1 in full; Google/Bing/OpenAI/Perplexity feeds (discovery); `/.well-known/ucp` serving a **discovery-only profile** (catalog capability only, checkout not advertised); public read-only **MCP server**; attribution |
| **P1** | UCP catalog REST endpoints; agent-originated order attribution; fraud/dispute rules for agent orders |
| **P2** | Agentic checkout (UCP Checkout / ACP-compatible endpoints) for explicitly opted-in products; identity linking; payment handlers |

Agentic checkout stays **off by default**, per-product opt-in (`is_eligible_checkout`), with an admin kill switch.

## 2.3 Feed/Manifest architecture

```text
Products / Variants / Inventory / Policies  ──►  Product Data Layer (canonical, validated, versioned)
                                                   ├─► Google Merchant exporter (scheduled fetch / Merchant API)
                                                   ├─► Bing Merchant exporter
                                                   ├─► OpenAI feed exporter (PUSH job: sample → daily snapshot [+ deltas])
                                                   ├─► Perplexity/Google-format file  (/feeds/perplexity)
                                                   ├─► UCP profile + catalog endpoints (/.well-known/ucp, /ucp/*)
                                                   ├─► MCP server (/mcp)
                                                   └─► JSON-LD / sitemaps / llms.txt / markdown twins
```

Public URLs (all outside `/api` prefix, served at storefront origin): `/.well-known/ucp`, `/.well-known/acp.json` (when ACP enabled), `/.well-known/oauth-authorization-server` (P2), `/feeds/perplexity`, `/feeds/google` (pull option), `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/mcp`.

## 2.4 Eligibility and checkout flags

- `is_eligible_search` default **true** for approved/active products; vendor can opt out per product.
- `is_eligible_checkout` default **false**; requires: vendor opt-in + admin platform kill switch **on** + product category not in restricted list + shipping/return policy URLs resolvable + payment rail configured.
- Structured shipping data per product/vendor: `country:region:service:price:min_handling:max_handling:min_transit:max_transit`, derived from the shipping module (08 §9).

## 2.5 Public MCP server (P0)

Read-only tools: `search_products(query, filters, limit)`, `get_product_details(id|slug)`, `check_availability(id, variant, postcode)`, `list_categories()`, `get_shipping_estimate(id, destination)`, `get_store_policies()`. No cart/checkout in P0. Auth: anonymous, rate-limited (per-IP and per-client), response size capped, no PII, no vendor private data, read-through the same Product Data Layer. Streamable HTTP transport at `/mcp`. Tool descriptions are factual and non-promotional. Logged for analytics.

## 2.6 Attribution, analytics, trust, compliance

- `AgentOrderAttribution` on every order: `agent` (chatgpt | gemini | perplexity | copilot | claude | other | organic), `protocol` (ucp | acp | feed-click | mcp | none), `source_ref`.
- Admin dashboard: agent impression share (where partner data exists), citation/mention rate (prompt panel), click-through, agent-attributed conversion and revenue; 30/60/90-day windows.
- Fraud/dispute rules for agent-originated orders (velocity, new-account, high-value, mismatched shipping/billing) feed manual review before shipment; return abuse tracked by `agent` dimension.
- Eligibility is opt-in at vendor/product level; kill switches: platform-wide (agentic checkout), per-protocol (UCP/ACP/MCP), per-vendor.
- Honor crawler policy; respect partner terms; do not serve different prices to agents than to humans (price parity rule, tested nightly).

---

# PART 3 — VISUAL SEARCH

## 3.1 Purpose and flow

Customer uploads/photographs an item; system returns visually similar ATVOO products. Mobile-first.

1. Tap camera icon in search bar → upload or capture.
2. Client downscales/compresses (max 1280px, JPEG/WebP, ≤ 2 MB) before upload.
3. `POST /api/v1/products/visual-search` → Visual Search Service creates an embedding with the configured vision-embedding model.
4. Cosine-similarity query on `ProductImageEmbeddings` (pgvector, HNSW index) → top-N, best-scoring image per product, filterable by category/price/vendor.
5. Query + results logged (`VisualSearchQueries/Results`) for tuning/gap detection. Uploaded query images are **deleted after 24h** unless the user opts in (privacy).

## 3.2 Data and indexing

- Embedding generated by background job on image upload/replace (never blocks vendor upload); reindex job for model upgrades (`embedding_model`, `embedding_version` columns; dual-write during migration).
- All images per product embedded; match uses best image.
- Index: pgvector **HNSW** with cosine ops; dimension fixed per model and recorded; `similarity_threshold` is a platform setting (default 0.75, tuned from logs).
- Default embedding provider: **open decision resolved** — use a hosted multimodal embedding API behind an `EmbeddingProvider` interface (swappable); provider/model recorded in env and DB rows. Do not hardcode vendor names outside the provider module.

## 3.3 Non-functional

- End-to-end < 2s p95 (upload → embed → search → render).
- Graceful degradation below threshold: closest category matches + prompt to refine with text; never an empty page.
- Abuse controls: rate limit (per IP/user), file-type sniffing, size cap, no storage of faces/PII beyond retention window, NSFW/prohibited-content rejection.

## 3.4 Related

Models: 02 "Visual Search Module". API: `POST /products/visual-search` (04). UI: 03 search & mobile sections.
