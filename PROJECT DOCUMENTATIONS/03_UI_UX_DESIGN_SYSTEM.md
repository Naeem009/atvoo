# UI/UX DESIGN SYSTEM

Revision 2 — this file is the single source of truth for visual design and UX. It now contains the full token set (light + dark), type/spacing/layout scales, component states, interaction patterns and the complete screen inventory (the handbook §7 only points here and adds implementation rules). All original content is retained.

Design Philosophy: Premium · Clean · Modern · Fast · Trustworthy · Mobile First · Conversion Focused

Design references: Apple, Nike, Stripe, Shopify Plus, Linear, Amazon.

---

# 1. COLOR SYSTEM

| Token | Light | Dark |
|---|---|---|
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

Dark Mode Required (system-preference default + manual toggle persisted per user/device). Implement as CSS custom properties (`--color-*`) on `:root` and `[data-theme="dark"]`; Tailwind reads the variables. Contrast must meet 4.5:1 (text) / 3:1 (large text, UI) in both themes — verify `Muted` on `Surface` and CTA text (use white text on CTA only if contrast ≥ 4.5:1, else `#0F172A`; CTA `#F97316` with white is ~2.8:1 so **use dark text `#0F172A` on CTA buttons or darken CTA to `#EA580C` for white-text buttons**). Semantic tints (e.g., Success 10% background) derived with `color-mix`.

# 2. TYPOGRAPHY

Primary Font: Inter. Fallback: Geist, then system UI stack. Loaded via `next/font` (self-hosted variable font, `display: swap`, subset latin; add Arabic/Urdu-capable font (e.g., Noto Nastaliq/Naskh) when Urdu/RTL ships).

| Role | Size / line-height | Weight | Use |
|---|---|---|---|
| Display | 48/56 | 700 | Hero headlines |
| H1 | 36/44 | 700 | Page titles |
| H2 | 30/38 | 700 | Section titles |
| H3 | 24/32 | 600 | Card/group titles |
| H4 | 20/28 | 600 | Sub-sections |
| H5 | 18/26 | 600 | Emphasised labels |
| H6 | 16/24 | 600 | Small headings |
| Body-lg | 18/28 | 400 | Lead text |
| Body | 16/24 | 400 | Default |
| Body-sm | 14/20 | 400 | Secondary, hints |
| Caption | 12/16 | 500 | Metadata |
| Price | tabular-nums, 600 | | Prices use tabular figures; currency symbol smaller (0.75em) |

Mobile: Display→36, H1→30, H2→26; below that unchanged. Max line length 75ch for prose. Never below 14px for interactive text on mobile (inputs 16px to prevent iOS zoom).

# 3. LAYOUT, SPACING, SHAPE, ELEVATION, MOTION

- **Spacing:** 4px base — 0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96.
- **Breakpoints (mobile-first):** sm 640, md 768, lg 1024, xl 1280, 2xl 1536.
- **Container:** max 1280px; side padding 16 (<md), 24 (md–lg), 32 (lg+). 12-col grid ≥ lg.
- **Product grids:** 2 cols (<sm), 3 (sm–md), 4 (lg), 5 (xl+). Gap 12 (mobile) / 16 / 24.
- **Radius:** sm 6 (chips/badges) · md 8 (buttons/inputs) · lg 12 (cards) · xl 16 (modals/sheets) · full (avatars/pills).
- **Elevation:** 0 flat · 1 `0 1px 2px rgba(15,23,42,.06)` · 2 `0 4px 12px rgba(15,23,42,.10)` · 3 `0 12px 32px rgba(15,23,42,.16)` · 4 `0 20px 48px rgba(15,23,42,.22)`; dark mode ≈1.5× opacity.
- **Z-index:** base 0 · sticky-header 10 · dropdown 20 · backdrop 30 · modal 40 · toast 50 · tooltip 60.
- **Motion:** 150ms micro, 250ms components, 350ms modals/pages; ease-out in, ease-in out; honour `prefers-reduced-motion`.
- **Touch targets:** ≥ 44×44px; bottom-nav safe-area insets on iOS (`env(safe-area-inset-*)`).
- **Iconography:** `lucide-react`, 20px default (24 for nav), 1.5–2px stroke; no mixed icon sets.
- **Imagery aspect ratios:** product card 1:1, hero 16:9 (mobile 4:5 crop allowed), vendor banner 3:1, avatar 1:1; reserve space (no CLS); blur-up placeholder.

# 4. COMPONENT LIBRARY AND STATES

Stack: Tailwind CSS (tokens via CSS variables) + shadcn/ui on Radix primitives + lucide-react. No second UI kit.

Core components: Button (primary/CTA/secondary/ghost/destructive; sizes sm/md/lg; loading), IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Slider (range), DatePicker, OTP input, Phone input, Stepper, Tabs, Accordion, Badge/Chip, Tag, Tooltip, Popover, DropdownMenu, Dialog, Sheet/Drawer, Toast, Alert/Banner, Breadcrumbs, Pagination, Table (sortable, selectable, sticky header), DataGrid for admin, Skeleton, EmptyState, ErrorState, Avatar, Rating (stars, read-only + input), PriceTag, QuantityStepper, VariantSelector (swatch/size), ProductCard, VendorCard, ReviewCard, CartLineItem, OrderSummary, AddressForm, PaymentMethodPicker, Timeline (order/shipment tracking), FileUploader (drag-drop, progress, MIME/size validation), RichText editor (CMS, sanitized), Calendar (schedule), Chart (line/bar/donut for dashboards).

**State matrix (every interactive component):** default · hover · focus-visible (2px Accent ring + offset) · active · disabled · loading · error · success. Selected/checked/expanded where relevant.

**Forms:** persistent label above field; hint below; validate on blur and on submit; error text under field in Error colour with icon + `aria-describedby`; required marker "*" with legend; autocomplete attributes (`name`, `email`, `tel`, `address-line1`, …); `inputmode` for mobile keyboards; disable submit while pending; preserve input on error; success feedback toast/inline. Checkout forms: max fields, address autocomplete/city list, phone formatting.

**Feedback:** Toasts (bottom-right desktop, full-width bottom mobile above tab bar; max 3; success/info 5s; errors persist; `aria-live`). Inline banners for page-level issues. Confirmation dialogs for destructive actions (type-to-confirm for irreversible admin actions).

**Dialog vs Sheet:** Dialog for confirmations/short forms; Sheet (right on desktop, bottom on mobile) for filters, cart, long forms.

**Data states (mandatory per view):** Skeleton → Content | Empty (message + primary action) | Error (plain message + Retry) | Partial/stale (banner + refresh) | Offline (PWA banner, cached content where available) | Forbidden (explain + path) | Not found.

# 5. ACCESSIBILITY

WCAG 2.1 AA; keyboard navigation everywhere (logical tab order, skip-to-content link, roving tabindex in menus/tabs/carousels); visible focus; screen-reader support with correct landmarks (`header`, `nav`, `main`, `footer`), headings hierarchy (one H1/page), `aria-live` for toasts/cart updates; ARIA only when native semantics insufficient; images with meaningful alt (decorative `alt=""`); carousels pausable with controls and not auto-advancing under reduced motion; no content conveyed by colour alone; form errors announced; focus trap in dialogs and return focus on close; time limits warn/extend (e.g., reservation timer); captions/transcripts for video; touch target ≥ 44px; zoom to 200% without loss; RTL-ready logical CSS properties (`margin-inline`, etc.).

# 6. SEARCH & DISCOVERY

Search Bar with Autosuggest (products, categories, brands, recent/popular queries; keyboard navigable combobox); Voice Search Icon (Web Speech API where supported, hidden otherwise); Visual Search Icon (camera / upload photo → "find products like this": capture UI, crop/preview, progress, results grid with similarity, "refine with text" fallback); AI Search Results (semantic, not just keyword; "Did you mean"; zero-result recovery with popular categories); Filters & Sort (desktop sidebar, mobile Sheet; price slider with inputs; attribute facets; availability, rating, vendor, brand, COD/free-shipping toggles; active chips with remove; result count; URL-synced).

# 7. HOMEPAGE

Announcement Bar; Hero Slider (max 5 slides; first image priority-loaded; no layout shift); Featured Categories; Category Grid; Flash Sale (server-time countdown, stock bar); Featured Products; Trending Products; Best Sellers; New Arrivals; Top Rated; Recommended Products (personalised, fallback best-sellers); Featured Vendors; Popular Brands; Customer Reviews; Video Reviews; Instagram Feed (via platform API/cached, with graceful hide); Blog Articles; Newsletter (double opt-in); Trust Badges (secure payment, COD, returns, verified vendors); Footer (links, payment icons, social, language/currency, policy links). Sections are CMS-ordered (`HomepageSections`). Below-the-fold sections lazy-render but remain in server HTML for crawlers.

# 8. LISTING PAGES (category, brand, vendor store, search, deals)

Breadcrumbs; H1 with count; filter bar/sidebar; sort; product grid; ProductCard (image, title ≤2 lines, price + compare-at + % off, rating, vendor, badges: Sponsored/Top Rated/Free Shipping/COD, wishlist heart, quick-add where no variants); pagination (numbered, SEO URLs — no infinite scroll that hides URLs; "Load more" with URL update allowed); SEO text block; related categories; empty state. Vendor store page adds banner, logo, rating, follower button, policies tab, about, contact, product tabs.

# 9. PRODUCT PAGE

Gallery (thumbnails, swipe, pinch/hover Zoom, fullscreen), 360 Viewer (when assets exist), Videos, Lifestyle Images; title, brand, rating summary, SKU; price block (tax note, discount, savings); Variants (swatches/size with availability states, size guide); stock/urgency (truthful only); Shipping & Delivery Estimate (city/postcode selector, COD availability, handling+transit); Add To Cart; Buy Now; Wishlist; Compare; Share (Web Share API + copy link); trust row (returns, warranty, verified vendor); highlights/specs table (structured attributes); description; Reviews (summary histogram, filters, photos, verified badge, helpful votes, vendor replies, AI summary labelled); FAQs; Questions & Answers; Related Products; Frequently Bought Together; Vendor Information card; recently viewed. **Sticky Add To Cart bar on mobile.** JSON-LD (07 §1.3) and server-rendered facts. Out-of-stock: notify-me, similar items.

# 10. CART, CHECKOUT, ORDER

- **Cart:** page + mini-cart Sheet; grouped by vendor (shipping per vendor group), qty stepper, remove/save for later, coupon field, gift card/points apply, price/stock change warnings, estimated delivery per group, order summary (subtotal, discounts, shipping, COD fee, tax, total), sticky checkout button on mobile, empty state with recommendations.
- **Checkout:** single column stepper mobile, two columns desktop. Steps: 1 Contact (email/phone, guest or login) → 2 Address → 3 Shipping (per vendor group) → 4 Payment (card hosted fields, JazzCash, Easypaisa, COD with OTP confirmation, wallet/points) → 5 Review & Place Order. Progress indicator, edit previous steps, inline validation, no dead ends, reservation countdown notice, idempotent place-order button (disabled after click), error recovery for payment failure (retry/other method, order kept). One Click Checkout (saved address + tokenised method, order review sheet).
- **Confirmation:** order number, summary, per-vendor delivery estimates, tracking link, create-account prompt for guests, share/referral CTA.
- **Order tracking** (`/track-order`, account): single order view with per-vendor shipments timeline, carrier + tracking number links, status history, invoice download, return/cancel/support actions by eligibility.

# 11. CUSTOMER ACCOUNT

Dashboard; Orders (list/detail/returns), Returns (wizard: select items, reason, photos, resolution), Refund status, Addresses, Payment methods, Wishlist (share, move to cart), Reviews (write/edit), Rewards (balance, history, expiry), Referral (link, stats), Gift cards (balance, redeem), Notifications & preferences, Security (password, 2FA, devices, sessions), Privacy (export/delete, consent), Support tickets (create/thread/attachments), Q&A asked.

# 12. AUTH & ONBOARDING SCREENS

Login, Register, Social login, Forgot/Reset password, Verify email, OTP, 2FA challenge, Vendor registration wizard (business info → documents upload → bank → agreement → submit → status tracker), Affiliate signup. Error/lockout/CAPTCHA states defined.

# 13. VENDOR PORTAL — CORE

Dashboard (sales, orders to ship, low stock, payouts, performance score, tasks); Products (table with filters/bulk actions, create/edit multi-step form with variants matrix, media manager with reorder, attribute fill with quality-score sidebar, SEO fields, AI-assist drafts clearly labelled, submit for review, status badges, rejection reasons); Bulk import/export wizard (template download, validation preview, error report); Inventory (warehouses, adjustments, history, thresholds); Orders (list, detail, pack/ship workflow, enter carrier+tracking, print packing slip/label, cancel/partial); Returns (respond, approve/reject, evidence); Shipping profiles/zones/rates; Payouts (escrow held/released, statements, bank details with step-up auth); Analytics (traffic, conversion, top products, AI/social attribution); Promotions (coupons, flash sale requests); Reviews & Q&A management; Customers/messages; Staff & permissions; Store profile/policies/branding; Plan & billing (entitlements, upgrade); Notifications.

# 14. VENDOR PORTAL — MARKETING / SOCIAL AUTOMATION

Connected Accounts Grid (platform cards: Facebook, Instagram, TikTok, Pinterest, X, WhatsApp; status/health badge, scopes, last validated, re-auth prompt); Connect / Disconnect Buttons (OAuth); Automation Toggle (per platform, off by default); Plan Gate Banner (upsell to Premium if entitlement missing — driven by entitlement keys, never tier names); Trigger Event Selector (New Product, Price Drop, Back In Stock, Flash Sale, Restock); Posting Schedule Calendar View; Post Approval Queue (review-before-publish mode; approve/edit/reject; bulk); AI Caption Preview Card (editable before publish; shows facts used, moderation result, provenance); Tone/Style Presets Selector; Frequency Cap & Blackout Hours Controls; Excluded Products/Categories List; Social Performance Dashboard (reach, engagement, clicks, attributable revenue); Audit/History Log of Published Posts (status, external link, errors); Campaign builder (objective, products, platforms, policy); Store-Channel Opt-In Card ("Allow my products to be featured on [Store]'s official social") + Tag-My-Handle Toggle + Excluded Products List + "Featured by [Store]" Performance (read-only).
**Autonomy control (new):** per platform, vendor chooses `MANUAL`, `APPROVAL_REQUIRED` (default), or `FULLY_AUTOMATIC` (requires explicit confirmation modal, entitlement, healthy account, and at least N approved posts history — see 06 addendum). A visible "Pause all automation" kill switch.

# 15. ADMIN PORTAL — CORE

Dashboard (GMV, orders, vendors, queues, alerts); Vendors (applications queue, document viewer, verification checklist, approve/reject/suspend, scores); Customers; Products (approval queue with diff view, reasons, bulk actions, duplicates, prohibited hits); Orders (search, detail, manual actions with audit); Returns/Disputes; Finance (payments, refunds, escrow view/release/reverse, payout batches, reconciliation, chargebacks, tax reports) with step-up auth; Marketing (campaigns, coupons, banners, flash sales); CMS (pages, blog, FAQ, menus, homepage builder, media library, SEO, email templates, policy versions); Reports (sales, vendors, products, taxes, cohorts, exports); Settings (08 §20) & Feature Flags; RBAC (roles/permissions matrix); Audit Logs viewer; Fraud queue; Support console (ticket inbox, SLA timers, macros); Agent Commerce & Discoverability dashboard (feed status/rejections, crawler traffic, AI referrals, prompt-panel results, kill switches); System health (queues, DLQ, outbox lag, jobs).

# 16. ADMIN PORTAL — STORE SOCIAL CHANNEL (Marketing Manager)

Store Accounts Panel (marketplace's own connected accounts); Curation Weight Sliders (Trending / New Arrivals / Best Sellers / Sponsored ratio); Editorial Calendar (queue view, approve/edit/reject, drag-to-reschedule); Sponsored Slot Booking Manager; Fairness Audit Report (posting frequency by vendor, flags imbalance); Store Channel Performance Dashboard; global kill switch.

# 17. MOBILE EXPERIENCE (PWA at launch)

Bottom Navigation (Home, Categories, Search (includes Visual Search camera button), Cart, Account); Sticky Add To Cart; Voice Search; Dark Mode; One Click Checkout; PWA Install (manifest, icons, splash, install prompt after engagement, service worker with offline shell, cached recently viewed + wishlist, offline banner, background sync for cart actions where feasible); Web Push opt-in at a contextual moment (not on first load); pull-to-refresh on lists; gesture-friendly galleries; Bottom Sheets for filters/cart.

# 18. SYSTEM PAGES

404 (search + popular links), 410, 500/error boundary, maintenance, offline, access denied, session expired, cookie consent banner/preferences, age gate (restricted categories), 301/redirect handling, empty states library, status/health page link in footer.

# 19. CONTENT & MICROCOPY

Tone: confident, plain, helpful; no dark patterns (no fake urgency, no pre-checked upsells/marketing consent, no hidden fees — total price visible before payment). Error messages say what happened + how to fix. Currency formatted `PKR 1,299` (Intl). Dates localised; relative time for recent events with absolute on hover. All strings in message catalogs (no hardcoded copy in components).

# 20. PERFORMANCE BUDGETS (UI)

LCP < 2.0s (p75 mobile 4G), INP < 200ms, CLS < 0.1; JS per route ≤ 170KB gz initial; hero image ≤ 150KB; fonts ≤ 2 files preloaded; third-party scripts (analytics/pixels) loaded after consent and deferred (`afterInteractive`/Partytown); image `sizes`/`srcset` correct; no layout-shifting banners.

# 21. DESIGN DELIVERABLES / DEFINITION OF DONE

Component library documented in Storybook with all states (light/dark, mobile/desktop); visual regression tests (Playwright/Chromatic) on key templates; axe accessibility checks in CI; every screen above has implemented loading/empty/error states; verified at sm/md/lg/xl and in dark mode.
