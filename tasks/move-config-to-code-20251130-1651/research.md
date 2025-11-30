---
task: move-config-to-code
timestamp_utc: 2025-11-30T16:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Move configuration out of database

## Requirements

- Functional: relocate all configuration currently stored in database tables to code/env files so that no config relies on runtime DB state.
- Non-functional: avoid breaking multi-restaurant behaviour; preserve authorization, caching, and performance; keep Supabase remote-only rules.

## Existing Patterns & Reuse

- Code-level config already exists in `config.ts` (app metadata, theme, emails) and `lib/env.ts` + `config/env.schema.ts` (feature flags, planner settings, reserve defaults, etc.).
- Strategic capacity config is loaded from env defaults (`env.strategic`) and optionally overridden from DB via `server/ops/strategic-config.ts` calling Supabase `strategic_configs`.
- Service policy (lunch/dinner windows, buffers, after-hours) is read from Supabase `service_policy` in `src/app/api/config/service-policy/route.ts` and `server/ops/tables.ts`.
- Feature flag overrides table `feature_flag_overrides` exists but is not referenced in app code (only migrations/seeds/utilities), so could be removed.
- Restaurant timing/reservation defaults stored on `restaurants` table (domain data) are consumed by `server/ops/tables.ts`; moving these to code would freeze per-restaurant variability.

## External Resources

- Existing env schema (`config/env.schema.ts`) and file-based configs under `config/demand-profiles.json` provide patterns for non-DB config.

## Constraints & Risks

- Per-restaurant settings (strategic weights, service periods, operating hours, reservation defaults) are inherently tenant-specific; moving to static code/env will remove ability to tune per restaurant without deploys.
- RLS/authorization currently guards config tables; code-level equivalents must ensure correct scoping to avoid leaking settings across tenants.
- API routes and services rely on DB fetches; removing tables without updating callers will break runtime.
- Seeds/migrations currently populate config tables; need coordinated migration + code changes + data backfill (or deletion) path.
- Must adhere to Supabase remote-only rule; we can author migrations but not run them locally.

## Open Questions (owner, due)

- Should per-restaurant variability be preserved (e.g., strategic weights per restaurant), or should all restaurants use a single global code value? **Decision: global code value for all restaurants.**
- What values should replace current DB rows (use current prod values frozen into code, or new defaults)? **Decision: use existing seeded defaults (lunch 12:00–15:30, dinner 17:00–22:30, buffer 10, strict conflicts staging=true/prod=false, strategic scarcity weight 22).**
- Are restaurant operating hours/service periods considered “config” to remove, or remain domain data? **Decision: keep restaurant domain data in DB; only env/prod-level config moves to code.**

## Recommended Direction (with rationale)

- Treat “config” for this task as the dedicated config tables: `strategic_configs`, `feature_flag_overrides`, `service_policy`; keep operational schedule data (`restaurant_operating_hours`, `restaurant_service_periods`, `restaurants.*defaults`) unless explicitly instructed to remove tenant flexibility.
- Move strategic settings to env-backed constants in `config/env.schema.ts` (per-env) with in-memory cache in `server/capacity/strategic-config.ts`; drop DB overrides and delete the table.
- Move service policy to a code/env structure (e.g., `config/service-policy.ts` or env schema), and update API/service callers to read from code; remove the table.
- Remove unused feature flag overrides table and references; rely on existing env-based feature flags in `lib/env.ts`.
- Provide migration scripts that drop these tables with rollback notes; ensure code paths no longer query them before drop.
- Document loss of runtime mutability and requirement for deploy to change config.
