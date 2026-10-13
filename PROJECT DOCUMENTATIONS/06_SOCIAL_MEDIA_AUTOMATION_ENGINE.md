# SOCIAL MEDIA AUTOMATION ENGINE (SMAE)
## Master Specification — Vendor Automation + Marketplace Campaigns + n8n

**Status:** Target-state source of truth  
**Module:** Social Media Automation Engine (SMAE)  
**Primary orchestrator:** n8n  
**Application owner:** ATVOO API/backend  
**Database:** Supabase PostgreSQL through the application data layer  

> **Core rule:** ATVOO owns business truth. n8n orchestrates work. Social platforms own final publication and provider metrics.

---

# 1. PURPOSE

SMAE automates the creation, approval, scheduling, publishing, and measurement of social content generated from ATVOO marketplace data and events.

It supports two separate operating modes:

1. **Vendor-owned automation** — a vendor explicitly connects its own social destinations and opts into automation.
2. **Marketplace-owned automation** — ATVOO promotes selected vendors, products, campaigns, categories, and editorial content from ATVOO-owned social accounts.

It must also support event-driven automation for new vendor products and material product changes.

SMAE is **never silent, implicit, or opt-out** for vendor accounts.

---

# 2. NON-NEGOTIABLE PRINCIPLES

- Explicit vendor opt-in is required before vendor-owned automation.
- Subscription entitlements are enforced server-side.
- Vendor/tenant isolation is mandatory.
- n8n is an orchestration layer, not the source of truth.
- n8n must normally call ATVOO APIs rather than directly mutate production tables.
- Every event, post, delivery, webhook, and workflow must be idempotent.
- AI output is untrusted until validated.
- Product facts always come from authoritative ATVOO data.
- Prices, discounts, stock, URLs, claims, and product specifications must be revalidated before publication.
- Platform capabilities are not assumed to be identical.
- One platform failure must not block other platforms or vendors.
- Provider API submission is not automatically equivalent to final publication.
- Credentials never enter browser responses, LLM prompts, or normal n8n execution payloads.
- Every automated post must be explainable from trigger → rule → content → approval → schedule → delivery → analytics.

---

# 3. SCOPE

## Included

- OAuth/social-account connection
- token lifecycle and reauthorization
- vendor automation rules
- product/event triggers
- campaign automation
- AI captions and platform-specific content
- hashtags where appropriate
- AI asset selection
- moderation and brand safety
- human approval
- scheduling and best-time recommendations
- frequency/cooldown controls
- publishing
- retries and dead-letter handling
- provider webhooks/status polling
- analytics and attribution
- n8n orchestration
- audit logging
- marketplace-owned campaigns

## Not included by default

- paid advertising and ad-budget spending
- arbitrary automated group posting
- unsolicited bulk messaging
- automated comments/replies
- unrestricted social listening
- influencer management

These require separate specifications.

---

# 4. CHANNEL MODEL

Do not model every platform as a generic `SocialAccount` with identical behavior.

Every destination has:

```text
platform
account_type
authorization_status
token_status
platform_account_id
destination_id
capabilities
scopes
timezone
locale
last_validated_at
```

Possible destinations include:

- Facebook Page
- Instagram Business/Professional account
- Pinterest Business account / board
- X account
- TikTok destination
- Google Business Profile location
- WhatsApp Business catalog

### Important

**WhatsApp Business Catalog is not an ordinary social-post destination.** It should use a separate capability such as `CATALOG_SYNC`. Catalog synchronization, messaging, and organic social publishing must not be conflated.

---

# 5. PLATFORM CAPABILITY REGISTRY

SMAE must maintain a capability registry rather than hard-code assumptions.

```text
PlatformCapability
------------------
platform
capability
supported
required_scopes
requires_business_account
requires_provider_approval
supported_media_types
max_text_length
supports_scheduling
supports_edit
supports_delete
supports_webhooks
supports_analytics
supports_external_link
supports_ai_disclosure
provider_api_version
last_verified_at
```

A platform adapter must refuse unsupported operations before a job reaches publication.

---

# 6. SUBSCRIPTION ENTITLEMENTS

Do not hard-code business behavior around tier names. Use entitlement keys.

Example:

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

Suggested commercial mapping:

### Starter
- manual Share to Social
- no event-triggered automation

### Growth
- scheduled posting
- limited connected destinations
- standard AI generation

### Premium
- multi-platform automation
- event-triggered posting
- AI content/asset selection
- best-time recommendations
- advanced analytics

### Enterprise
- Premium features
- A/B variants
- custom cadence/governance
- advanced isolation and white-label features where implemented

The API, not the frontend or n8n, decides entitlement.

---

# 7. TENANCY AND AUTHORIZATION

For every vendor operation:

```text
Authenticated user
→ vendor membership
→ vendor permission
→ subscription entitlement
→ social-account ownership
→ rule ownership
→ requested operation
```

Changing an ID in a request must never allow cross-vendor access.

Every vendor-owned social entity must contain or derive an unambiguous `vendor_id`.

Marketplace-owned objects must use a separate ownership model and must not be treated as vendor-owned objects.

---

# 8. SOCIAL ACCOUNT CONNECTION

Connection flow:

```text
Vendor
→ Select platform
→ ATVOO OAuth initiation
→ Provider consent
→ OAuth callback
→ Validate state/identity/scopes
→ Encrypt credential/token metadata
→ Discover destinations
→ Validate capabilities
→ Select destination
→ CONNECTED
```

Required:

- minimum scopes
- OAuth state protection
- PKCE where supported/required
- no tokens in URLs
- encrypted sensitive credentials
- token refresh where supported
- reauthorization handling
- disconnect handling
- credential redaction

When a vendor disconnects, ATVOO must immediately stop using the credential and disable publishing. Actual provider-side revocation timing depends on the provider.

---

# 9. AUTOMATION RULES

A rule defines **what, where, when, how often, and under what approval policy** content may be generated/published.

Example:

```text
trigger = PRODUCT_PUBLISHED
platforms = INSTAGRAM, FACEBOOK
categories = Fashion
max_posts_per_day = 2
product_cooldown_hours = 72
tone = LUXURY
approval = REQUIRED
schedule = BEST_TIME
active = true
```

Rule conditions should include:

- trigger types
- platforms/destinations
- products/categories/brands
- exclusions
- objective
- tone/language
- frequency cap
- cooldown
- blackout windows
- approval mode
- schedule strategy
- campaign

---

# 10. TRIGGERS

Initial triggers:

```text
PRODUCT_PUBLISHED
PRODUCT_APPROVED
PRICE_DROP
PRODUCT_PRICE_CHANGED
BACK_IN_STOCK
RESTOCKED
FLASH_SALE_STARTED
CAMPAIGN_STARTED
BEST_SELLER_ACHIEVED
PRODUCT_FEATURED
MANUAL_POST_NOW
MANUAL_CAMPAIGN
SCHEDULED_CONTENT
MARKETPLACE_EDITORIAL
```

Future triggers may include seasonal events, review milestones, category trends, and vendor milestones.

Triggers must be structured events, not free-form text.

---

# 11. EVENT CONTRACT AND IDEMPOTENCY

Every automation event must contain:

```json
{
  "event_id": "evt_01...",
  "event_type": "PRODUCT_PUBLISHED",
  "schema_version": 1,
  "occurred_at": "2026-09-22T08:30:00Z",
  "vendor_id": "vendor_123",
  "correlation_id": "corr_123",
  "source": "ATVOO",
  "payload": { "product_id": "product_456" }
}
```

`event_id` is immutable and reused across retries.

Duplicate delivery must return/reuse the existing result rather than create another social post.

Recommended business-level deduplication considers:

```text
vendor + rule + trigger + source entity + platform + content window
```

---

# 12. PRODUCT ELIGIBILITY GATE

Before AI generation, verify:

- product exists and is approved/published
- vendor is active
- subscription permits automation
- social destination is connected
- product/category is not excluded
- product is not restricted
- approved media exists when required
- URL is valid
- price/currency are current
- stock is compatible with the trigger
- campaign/offer is active
- frequency/cooldown permit posting
- duplicate-content check passes

The event payload is not authoritative. Re-fetch authoritative product data through the ATVOO API.

---

# 13. AI CONTENT GENERATION

AI must receive structured, validated facts such as:

```text
product_name
brand
category
approved_features
price
currency
discount
availability
vendor_name
product_url
approved_claims
tone
platform
objective
CTA
language
locale
```

AI output should be schema-validated JSON:

```json
{
  "caption": "...",
  "hashtags": ["..."],
  "cta": "...",
  "asset_id": "...",
  "destination_url": "...",
  "disclosures": [],
  "variant": "A"
}
```

AI must never invent:

- price
- discount
- specifications
- certifications
- medical claims
- delivery promises
- guarantees
- stock quantities
- reviews/testimonials
- URLs

Product descriptions are untrusted input and must not be allowed to override system instructions.

---

# 14. PLATFORM-SPECIFIC CONTENT

Do not generate one universal caption and blindly copy it to every platform.

Pipeline:

```text
Canonical product facts
→ content strategy
→ platform-specific generation
→ schema validation
→ moderation
→ approval
→ scheduling
→ publication
```

The platform adapter is responsible for final technical validation.

---

# 15. ASSET SELECTION AND MEDIA

Only approved ATVOO media may be published.

Asset selection must consider:

- ownership/licensing
- platform dimensions
- aspect ratio
- resolution
- file type/size
- product relevance
- prior performance
- campaign rules

Use durable object storage. Do not depend on local filesystem paths or ephemeral n8n files.

Provider-specific media transformations must happen before publishing.

---

# 16. MODERATION AND SAFETY

Every auto-publish candidate must pass:

### Product truth
- product name
- price
- discount
- stock
- URL
- factual claims

### Brand/policy
- banned terms
- restricted categories
- deceptive claims
- unsafe claims
- vendor brand rules
- platform rules

### Technical
- text limits
- media validity
- URL validity
- CTA validity
- required disclosures

Results:

```text
PASSED
PASSED_WITH_WARNINGS
REQUIRES_HUMAN_REVIEW
BLOCKED
```

---

# 17. APPROVAL AND POST STATE MACHINE

Approval is a first-class state.

```text
DRAFT
→ MODERATION_PENDING
→ APPROVAL_REQUIRED
→ APPROVED
→ SCHEDULED
→ READY_TO_PUBLISH
→ PUBLISHING
→ SUBMITTED
→ PROCESSING
→ PUBLISHED
```

Failure branches:

```text
APPROVAL_REQUIRED → REJECTED
MODERATION_PENDING → BLOCKED
PUBLISHING → RETRY_PENDING
PUBLISHING → REQUIRES_REAUTH
PUBLISHING → FAILED
PROCESSING → FAILED
```

Invalid state transitions must be rejected by the API.

---

# 18. FINAL PRE-PUBLISH GATE

Even with auto-publish enabled, immediately before publication verify:

```text
subscription active?
account connected?
authorization valid?
rule active?
vendor active?
product still eligible?
price still valid?
stock still valid?
campaign active?
approval still valid?
frequency cap available?
blackout window passed?
duplicate detected?
platform capability valid?
asset valid?
moderation passed?
```

If a mandatory check fails, do not publish. Cancel, regenerate, reschedule, or route to review.

---

# 19. SCHEDULING

Supported strategies:

```text
IMMEDIATE
FIXED_TIME
BEST_TIME
NEXT_ALLOWED_WINDOW
MANUAL
```

Store:

```text
requested_time
vendor_timezone
computed_utc_time
schedule_strategy
best_time_model_version
blackout_policy_version
```

All timestamps are stored in UTC.

Vendor timezone is the default for vendor-owned automation.

---

# 20. FREQUENCY, COOLDOWN, AND FATIGUE

Controls must exist at multiple levels:

- vendor/day
- vendor/platform/day
- destination/day
- product/cooldown
- category/cooldown
- campaign
- identical-content hash
- near-duplicate content

Example:

```text
Vendor = 5/day
Instagram = 3/day
Product cooldown = 72h
Same content hash = 30 days
```

These checks must be atomic enough to prevent concurrent workers from both passing the same limit.

---

# 21. CAMPAIGNS

Introduce a first-class `SocialCampaigns` entity.

Suggested fields:

```text
id
vendor_id nullable
owner_type
name
objective
start_at
end_at
target_products
target_categories
target_platforms
frequency_policy
approval_policy
status
created_at
updated_at
```

Objectives include:

```text
AWARENESS
TRAFFIC
PRODUCT_DISCOVERY
SALE
RESTOCK
PROMOTION
SEASONAL
BRAND_BUILDING
ENGAGEMENT
```

A trigger answers **why the workflow started**. An objective answers **what the content is trying to achieve**.

---

# 22. MARKETPLACE AUTOMATION

Marketplace automation is separate from vendor automation.

ATVOO-owned accounts may promote:

- featured products
- selected vendors
- categories
- seasonal campaigns
- marketplace offers
- editorial content

Vendor authorization never implies permission for ATVOO to use that vendor's account outside the configured scope.

---

# 23. GROUPS/AUDIENCES

The phrase "automatically post to relevant groups/audiences" must not be implemented as unrestricted group spam.

SMAE may optimize for:

- platform audience
- vendor audience settings
- hashtags
- Pinterest boards
- categories
- content themes
- platform-supported targeting metadata

Automatic posting to arbitrary groups/communities is prohibited unless the platform explicitly supports it and the destination is explicitly authorized.

---

# 24. PLATFORM ADAPTER CONTRACT

```typescript
interface SocialPlatformAdapter {
  validateConnection(): Promise<ConnectionStatus>;
  getCapabilities(): Promise<PlatformCapabilities>;
  validateContent(input: SocialPublishInput): Promise<ValidationResult>;
  publish(input: SocialPublishInput): Promise<PublishResult>;
  getPublishStatus(externalPostId: string): Promise<PublishStatus>;
  delete?(externalPostId: string): Promise<DeleteResult>;
  fetchAnalytics?(input: AnalyticsQuery): Promise<AnalyticsResult>;
  handleWebhook?(payload: unknown): Promise<WebhookResult>;
}
```

Provider-specific API details stay inside adapters.

---

# 25. IDEMPOTENT PUBLISHING

Every delivery has an internal idempotency key, for example:

```text
social_post_target_id
```

If a provider supports idempotency, use it.

If it does not, reconcile provider state before retrying a timed-out request. This prevents:

```text
request sent
→ timeout
→ provider actually published
→ retry
→ duplicate post
```

---

# 26. RETRIES AND DLQ

Retry only transient failures:

- network failure
- 429
- temporary 5xx
- provider processing timeout

Do not blindly retry:

- invalid token
- missing permission
- invalid media
- invalid content
- account suspension
- unsupported capability
- policy rejection

Honor provider `Retry-After` where available.

Exhausted jobs enter a dead-letter queue containing:

```text
job_id
social_post_target_id
vendor_id
platform
failure_class
provider_error_code
safe_error_message
attempt_count
first_failed_at
last_failed_at
next_action
```

---

# 27. DATABASE MODEL — REQUIRED REVISION

The existing list:

```text
VendorSocialAccounts
SocialAutomationRules
SocialAutomationTriggers
SocialPostQueue
SocialPostTemplates
SocialPostAssets
SocialPostAnalytics
SocialPlatformWebhookEvents
SocialContentModerationLogs
```

is not sufficient for the target system.

Add/separate:

```text
SocialCampaigns
SocialCampaignTargets
SocialPosts
SocialPostTargets
SocialPostVariants
SocialPostDeliveryAttempts
SocialPostAssets
SocialPostAnalytics
SocialAutomationRules
SocialAutomationTriggers
SocialPlatformWebhookEvents
SocialContentModerationLogs
SocialRateLimitEvents
SocialWorkflowRuns
SocialContentUsage
```

`SocialPosts` is the authoritative content object.

`SocialPostTargets` represents one post delivered to one destination.

`SocialPostDeliveryAttempts` preserves delivery history.

`SocialPostQueue` may remain as an operational projection/queue but must not be the only source of social-post truth.

---

# 28. CORE RELATIONSHIP MODEL

```text
Vendor
 ├── VendorSocialAccounts
 ├── SocialAutomationRules
 ├── SocialCampaigns
 │    ├── SocialCampaignTargets
 │    └── SocialPosts
 │         ├── SocialPostVariants
 │         ├── SocialPostAssets
 │         ├── SocialPostTargets
 │         │    └── SocialPostDeliveryAttempts
 │         └── SocialPostAnalytics
 └── SocialContentUsage
```

Every relationship must preserve vendor ownership or explicitly identify marketplace ownership.

---

# 29. SOCIAL POST TARGET

Recommended fields:

```text
id
social_post_id
social_account_id
platform
destination_id
status
scheduled_at
submitted_at
published_at
external_post_id
external_url
provider_status
provider_response_code
error_code
error_message
attempt_count
last_attempt_at
created_at
updated_at
```

This model is essential because one logical content item can have different platform outcomes.

---

# 30. DELIVERY ATTEMPT

```text
id
social_post_target_id
attempt_number
idempotency_key
started_at
completed_at
status
provider_request_id
provider_response_code
provider_error_code
safe_error_message
retryable
created_at
```

Never overwrite the complete history with only the latest error.

---

# 31. WEBHOOK EVENT MODEL

`SocialPlatformWebhookEvents` must be append-only and idempotent.

Required:

```text
platform
external_event_id
event_type
received_at
signature_valid
payload_hash
processing_status
processed_at
error_code
```

Unique key:

```text
(platform, external_event_id)
```

Webhook endpoints acknowledge quickly and process asynchronously.

---

# 32. ANALYTICS

Metrics must distinguish provider metrics from normalized/attributed metrics.

Possible metrics:

```text
impressions
reach
views
likes
comments
shares
saves
clicks
engagement_rate
video_views
watch_time
conversions
orders
revenue
```

A missing provider metric is `null`, not zero.

Use periodic snapshots because provider metrics may change.

Suggested observation windows:

```text
1h / 6h / 24h / 7d / 28d
```

---

# 33. ATTRIBUTION

Generated marketplace URLs should support tracking, for example:

```text
utm_source=instagram
utm_medium=organic_social
utm_campaign=spring_sale
utm_content=variant_a
utm_social_post=<post_id>
utm_vendor=<vendor_id>
```

Never place secrets or personal data in tracking parameters.

Attribution must distinguish:

```text
click → product view → cart → checkout → order → revenue
```

Where provider data cannot be joined reliably, report the limitation rather than fabricate attribution.

---

# 34. PRODUCT CHANGE REVALIDATION

Example:

```text
09:00 price = 1,999
09:05 content generated
09:30 price = 2,199
10:00 scheduled publication
```

At publication time the current price must be re-read.

If content is stale:

```text
cancel
OR regenerate
OR require new approval
```

The same rule applies to stock, product status, campaign expiry, and material media changes.

---

# 35. N8N ROLE

n8n is responsible for orchestration such as:

- receiving events
- calling ATVOO APIs
- AI generation
- transformations
- workflow routing
- provider integration where appropriate
- notifications
- retries
- scheduled analytics synchronization

ATVOO remains responsible for:

- vendor ownership
- permissions
- subscription
- product truth
- social account state
- automation rules
- post state
- approval
- audit
- attribution

If n8n is deleted, recreated, or replaced, business state must remain intact.

---

# 36. N8N DATABASE ACCESS

Preferred:

```text
n8n → ATVOO API → Supabase PostgreSQL
```

Avoid:

```text
n8n → arbitrary SQL → production tables
```

A restricted read-only analytics connection may be approved separately, but business mutations must go through documented APIs.

---

# 37. N8N WORKFLOW FAMILIES

Do not build one giant workflow.

Recommended workflows:

### WF-01 Product Event Intake
```text
Webhook → signature validation → idempotency → acknowledge → queue
```

### WF-02 Eligibility
```text
event → vendor/product/rules/subscription → capability/frequency checks
```

### WF-03 AI Generation
```text
content job → canonical facts → platform generation → schema validation
```

### WF-04 Moderation
```text
draft → fact check → policy → brand → platform validation
```

### WF-05 Approval
```text
approval required → vendor notification → approval/rejection event
```

### WF-06 Scheduler
```text
approved → timezone/blackout/best-time/frequency → delivery job
```

### WF-07 Publisher
```text
delivery → final validation → provider → status capture
```

### WF-08 Provider Status
```text
webhook/poll → verify → idempotency → update ATVOO
```

### WF-09 Analytics
```text
provider metrics → normalize → snapshot → attribution
```

### WF-10 Failure Recovery
```text
failure → classify → retry → reconcile → DLQ → notify
```

---

# 38. N8N WEBHOOK SECURITY

Every inbound webhook must authenticate the caller.

Recommended:

```text
HMAC signature
+ timestamp
+ nonce
+ event_id/idempotency key
```

Reject invalid signatures before expensive processing.

n8n execution data must not contain OAuth access/refresh tokens or unnecessary PII.

---

# 39. N8N CREDENTIAL MODEL

Provider credentials should remain under ATVOO's controlled credential boundary wherever practical.

n8n should use a narrowly scoped, rotatable service credential to call ATVOO.

Do not place broad production database credentials in ordinary n8n workflows.

Development, staging, and production credentials must be completely separated.

---

# 40. OUTBOX / EVENT DELIVERY

Product state changes and social events should use a transactional outbox pattern:

```text
DB transaction
 ├── update product
 └── write outbox event
        ↓
     dispatcher
        ↓
       n8n
```

This prevents a product from becoming published while the corresponding social event is lost.

Retries reuse the same event ID.

---

# 41. PLATFORM-SPECIFIC RULES

## TikTok

The current official Content Posting API supports direct video and photo posting, has provider-specific scopes/approval requirements, and uses asynchronous publication status. Production behavior may require app approval/audit. citeturn0search0turn0search1turn0search14

The adapter must also support applicable AI-generated-content disclosure and provider media rules. TikTok documents restrictions on adding unwanted promotional branding/watermarks to shared content. citeturn0search3

## Pinterest

Pinterest supports creating/managing Pins and boards, with scoped OAuth authorization and image/video content support. The adapter must model the board/section destination rather than treating Pinterest as a generic feed. citeturn1search0turn1search8

## Google Business Profile

Treat this as a business/location channel, not a generic social network. Google provides APIs for local posts and Business Profile management, but access and policy requirements apply. citeturn0search5turn0search10turn0search12

## X

X API capabilities, endpoint availability, access levels, rate limits, and publishing permissions must be verified for the actual developer account. Do not implement against deprecated/private endpoints or assume one universal capability set. citeturn2search6

## Facebook / Instagram

Use only current official Meta APIs and approved permissions. The adapter must validate account type, page/business relationship, publishing permission, media requirements, API version, review requirements, and analytics permissions at implementation time.

## WhatsApp Business Catalog

Implement as `CATALOG_SYNC`, with product transformation, provider-ID reconciliation, sync status, and error recovery. Do not model catalog synchronization as an ordinary social post.

---

# 42. SOCIAL ACCOUNT HEALTH

States:

```text
HEALTHY
WARNING
REAUTH_REQUIRED
DISCONNECTED
SUSPENDED
CAPABILITY_CHANGED
```

Periodic validation must detect expired/revoked authorization and changed capabilities.

---

# 43. DISCONNECT / SUBSCRIPTION DOWNGRADE

Disconnect:

```text
account = DISCONNECTED
automation disabled
pending deliveries cancelled
future publication blocked
token usage blocked
```

Historical records remain unless retention policy requires deletion.

Subscription downgrade:

- historical posts remain
- future automation is entitlement-checked
- scheduled jobs are revalidated
- already-published content is not deleted automatically

---

# 44. CONTENT PROVENANCE

Every post must be traceable:

```text
Product
→ Event
→ Automation Rule
→ Campaign
→ AI Generation
→ Moderation
→ Approval
→ Schedule
→ Delivery
→ Provider Post
→ Analytics
→ Attribution
```

Store prompt/model/version metadata and a hash/snapshot of the facts used to generate the post.

---

# 45. AUDIT EVENTS

At minimum:

```text
SOCIAL_ACCOUNT_CONNECTED
SOCIAL_ACCOUNT_DISCONNECTED
AUTOMATION_ENABLED
AUTOMATION_DISABLED
RULE_CREATED
RULE_UPDATED
POST_GENERATED
POST_MODERATED
POST_APPROVED
POST_REJECTED
POST_SCHEDULED
POST_CANCELLED
POST_SUBMITTED
POST_PUBLISHED
POST_FAILED
TOKEN_REFRESHED
TOKEN_EXPIRED
WEBHOOK_RECEIVED
ANALYTICS_SYNCED
```

Each event includes actor, vendor/owner, entity, action, timestamp, correlation ID, request ID, and result.

---

# 46. OBSERVABILITY

Track:

```text
automation_events_received
content_jobs_created
content_generation_success/failure
moderation_pass/block
approval_wait_time
posts_scheduled
posts_published
publish_failures
publish_retries
provider_429
provider_5xx
token_expiry
reauth_required
webhook_failures
analytics_failures
dlq_count
```

Segment by platform, vendor, workflow, environment, and error class.

---

# 47. N8N / WORKFLOW VERSIONING

Every production workflow must have:

```text
workflow_name
workflow_version
environment
owner
activation_status
last_modified_at
rollback_version
error_workflow
```

Events and workflow-run records should retain the workflow version used.

Recommended `SocialWorkflowRuns` fields:

```text
id
workflow_type
workflow_version
vendor_id
source_event_id
social_post_id
n8n_execution_reference
status
started_at
completed_at
error_code
```

Never store secrets in this table.

---

# 48. TESTING

## Unit

- entitlement checks
- rule matching
- frequency/cooldown
- content validation
- state transitions
- idempotency
- URL generation

## Integration

- OAuth callback
- token refresh
- adapter calls
- webhook verification
- n8n API contract
- database uniqueness
- outbox delivery

## End-to-end

```text
product published
→ event
→ n8n
→ eligibility
→ AI
→ moderation
→ approval
→ schedule
→ provider
→ status
→ analytics
```

## Failure tests

Test duplicate events, duplicate workflows, duplicate publish after timeout, expired token, revoked permission, 429, 5xx, invalid media, product deletion, out-of-stock, price change, subscription expiry, n8n outage, duplicate webhook, and provider reconciliation.

---

# 49. DEFINITION OF DONE

A platform is not complete merely because a post can be created.

It is complete only when:

- OAuth works
- scopes are verified
- tokens are secure
- destination discovery works
- content validation works
- moderation works
- approval works where required
- scheduling works
- duplicate protection works
- rate limits work
- retries work
- provider status is reconciled
- webhook/polling handling works
- analytics work where available
- disconnect works
- vendor isolation works
- audit works
- n8n workflow is versioned
- error workflow is tested
- production credentials are isolated
- provider policy requirements are documented
- automated tests pass

---

# 50. PROHIBITED BEHAVIOR

The implementation MUST NOT:

1. publish without explicit authorization
2. bypass subscription entitlement
3. bypass vendor isolation
4. expose OAuth tokens to the frontend
5. send OAuth tokens to AI providers
6. allow n8n arbitrary production-table mutation
7. trust frontend subscription values
8. trust AI-generated commercial facts
9. publish stale prices
10. publish known out-of-stock products as available
11. retry non-retryable failures indefinitely
12. create duplicate posts from duplicate events
13. assume all platforms support identical content
14. automatically spam arbitrary groups/communities
15. use undocumented/private platform APIs
16. use development social credentials in production
17. store secrets in n8n execution data
18. treat API submission as proof of final publication
19. delete required audit/financial records merely because a vendor requests deletion
20. let product text override system/policy instructions

---

# 51. IMPLEMENTATION ORDER

## Phase 1 — Foundation

1. VendorSocialAccounts
2. OAuth/connect/disconnect
3. entitlement checks
4. SocialPosts
5. SocialPostTargets
6. platform adapter contract
7. manual Share to Social
8. first Meta adapter(s)
9. basic analytics

## Phase 2 — Automation

10. transactional outbox
11. n8n event intake
12. automation rules
13. AI generation
14. moderation
15. approval queue
16. scheduler
17. retry/DLQ
18. idempotency/reconciliation

## Phase 3 — More platforms

19. Pinterest
20. X
21. TikTok
22. provider webhooks
23. platform-specific media

## Phase 4 — Intelligence

24. campaigns
25. best-time recommendations
26. A/B testing
27. advanced analytics
28. marketplace-owned automation

## Phase 5 — Commerce channels

29. WhatsApp catalog synchronization
30. Google Business Profile
31. additional approved platforms

---

# 52. MASTER ARCHITECTURE

```text
ATVOO Products / Vendors / Campaigns
                 │
                 ▼
        Transactional Outbox
                 │
                 ▼
              n8n
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
 Eligibility   AI/Content  Enrichment
       │         │          │
       └─────────┼──────────┘
                 ▼
       Moderation / Policy
                 │
          ┌──────┴──────┐
          ▼             ▼
        Review        Auto
          └──────┬──────┘
                 ▼
          SocialPosts
                 │
          SocialPostTargets
                 │
              Scheduler
                 │
       ┌─────────┼─────────────┐
       ▼         ▼             ▼
   Facebook  Instagram     Pinterest
       │         │             │
       └──── X / TikTok / other adapters
                 │
                 ▼
        Provider status/webhooks
                 │
                 ▼
          Analytics + Attribution
                 │
                 ▼
          Vendor / Admin Dashboard
```

---

# 53. FINAL ARCHITECTURAL DECISION

SMAE is a multi-tenant, event-driven, policy-controlled social publishing system.

**ATVOO owns the truth. n8n coordinates the work. Platform adapters communicate with providers. Providers own final publication state and provider-native metrics.**

This separation is mandatory so that the project can replace n8n, add another workflow engine, add new social platforms, recover from failed executions, and maintain vendor/business integrity without rebuilding the social data model.

---

# 54. EXTERNAL VERIFICATION NOTES

Provider-specific capabilities must be re-verified whenever an adapter is implemented or upgraded.

- TikTok's current official Content Posting API supports direct photo/video posting, has provider-specific approval/scopes, and exposes asynchronous post status. citeturn0search0turn0search14
- Pinterest supports creating/managing Pins and boards through scoped OAuth APIs. citeturn1search0turn1search8
- Google Business Profile provides APIs for business-profile management and local posts, with access and policy requirements. citeturn0search5turn0search10
- n8n provides workflow automation and a security-audit mechanism that should be included in operations. citeturn1search7turn1search2

The provider documentation is authoritative for provider-specific behavior. This SMAE document is authoritative for ATVOO's internal business rules and architecture.
