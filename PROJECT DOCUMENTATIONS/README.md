# ATVOO — Project Documentation

*AI-Based Most Modern Shopping Store — multi-vendor marketplace, LLM-discoverable, with automated social marketing*

**Start with the [Developer Handbook](./00_DEVELOPER_HANDBOOK.md)** — the canonical onboarding, build-plan and operations guide. The numbered documents are the specialist specifications. Together (00–09) they are the complete, Cursor-ready source of truth: no external decisions are required to start building.

| Document | Purpose |
|----------|---------|
| [00_DEVELOPER_HANDBOOK.md](./00_DEVELOPER_HANDBOOK.md) | Setup, environments, architecture, build plan, workflows, testing, deployment, troubleshooting |
| [01_PROJECT_MASTER_SPECIFICATION.md](./01_PROJECT_MASTER_SPECIFICATION.md) | Vision, modules, features, launch scope, success metrics, market-weakness mapping |
| [02_DATABASE_ARCHITECTURE.md](./02_DATABASE_ARCHITECTURE.md) | Data models, conventions, Supabase/RLS rules, sub-order model, reconciled social model |
| [03_UI_UX_DESIGN_SYSTEM.md](./03_UI_UX_DESIGN_SYSTEM.md) | Tokens (light/dark), scales, components & states, accessibility, every screen |
| [04_API_ARCHITECTURE.md](./04_API_ARCHITECTURE.md) | API contracts, full endpoint inventory, UCP/MCP/feeds, internal n8n endpoints |
| [05_DEVELOPMENT_STANDARDS.md](./05_DEVELOPMENT_STANDARDS.md) | Code, testing, security, CI gates, git workflow, DevOps, observability, Cursor rule |
| [06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md](./06_SOCIAL_MEDIA_AUTOMATION_ENGINE.md) | Vendor + store social automation: n8n, outbox, OAuth, AI posting, autonomy modes (see Implementation Addendum) |
| [07_AI_AGENT_COMMERCE_READINESS.md](./07_AI_AGENT_COMMERCE_READINESS.md) | LLM/search discoverability (robots, JSON-LD, sitemaps, llms.txt, feeds), UCP/ACP/MCP, visual search |
| [08_BUSINESS_RULES_AND_DOMAIN_FLOWS.md](./08_BUSINESS_RULES_AND_DOMAIN_FLOWS.md) | Resolved business rules: vendors, catalog, orders, COD, shipping, returns, escrow/payouts, loyalty, settings |
| [09_LAUNCH_READINESS_AND_OPERATIONS.md](./09_LAUNCH_READINESS_AND_OPERATIONS.md) | External approvals & lead times, topology, Supabase hardening, SLOs, DR, security/load gates, go-live checklist |

`SETUP_DATABASE.md` is retired (superseded by handbook §3–§4).

Read the handbook and every relevant specification **before** generating code. Precedence when documents disagree: running code/migrations → handbook → numbered specs (more specific document wins; addenda beat the numbered sections they amend) → roadmap. Record any gap as an ADR/assumption instead of guessing.
