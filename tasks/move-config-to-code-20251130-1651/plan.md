---
task: move-config-to-code
timestamp_utc: 2025-11-30T16:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Move algorithmic configuration out of database

## Objective

Eliminate database-stored algorithmic configuration (strategic weights/flags) so those values come from code/env. Keep restaurant-specific settings (service policy, operating hours, service periods) in the database.

## Success Criteria

- [ ] App boot and core flows succeed without querying DB for algorithmic config.
- [ ] Strategic settings are served from code/env with sensible defaults and validation; service policy remains DB-backed.
- [ ] DB migrations cleanly drop obsolete config tables with rollback notes.
- [ ] Tests updated/passing; manual QA verifies affected endpoints.

## Architecture & Components

- `config/env.schema.ts` & `lib/env.ts`: add schema + typed accessors for strategic settings; include defaults.
- `server/capacity/strategic-config.ts`: strip Supabase dependency; load from env-backed constants; remove override/apply paths.
- `server/ops/strategic-config.ts` & related API routes/hooks/services: refactor to consume code-level config; remove Supabase calls.
- `src/app/api/config/service-policy/route.ts` & `server/ops/tables.ts`: continue to read service policy from DB (restaurant-level data).
- Remove feature flag overrides plumbing (table + any loaders); rely on existing env-based flags.

## Data Flow & API Contracts

- Strategic settings API `GET/POST /api/ops/settings/strategic-config`: return code-level values; POST disabled/returns 501 with guidance (deploy-time config).
- Service policy API `GET /api/config/service-policy`: still returns DB-backed policy for restaurant operations.

## UI/UX States

- Strategic settings UI (ops dashboard) should display current code values and clearly indicate they are deploy-time constants; editing should be disabled or surface an error.
- Error states: show informative message if update not supported.

## Edge Cases

- Missing env vars: fall back to defaults with validation and log warnings.
- Multi-restaurant context: code-level config applies globally; ensure no leakage of stale per-restaurant overrides.
- Existing cached DB overrides: clear/invalidate any caches referencing Supabase rows.
- Restaurant service policy remains per-restaurant; ensure API/services still load from DB.

## Testing Strategy

- Unit: update/add tests for `server/capacity/strategic-config`, `server/ops/strategic-config`, and service policy provider.
- API: adjust route handler tests to expect code-backed strategic responses and service-policy DB responses.
- Integration/smoke: hit `GET /api/config/service-policy` (DB) and strategic settings endpoints (env); POST returns controlled response.
- No new migrations executed locally per Supabase remote-only; validate SQL syntax locally.

## Rollout

- Feature flag: none; change is global.
- Migration ordering: ship code changes first to stop querying strategic/flag tables; optional cleanup migration may clear old strategic/feature_flag overrides (service_policy stays).
- Monitoring: watch API error rates for strategic/service-policy endpoints after deploy.
- Kill-switch: retain ability to revert deploy + roll back migration if needed.

## DB Change Plan

- Target envs: staging → production after verification.
- Migration: clear or drop `strategic_configs` and `feature_flag_overrides`; keep `service_policy` intact. Provide rollback script if we later drop tables.
- Backups: require confirmation of PITR/backup before prod apply; attach dry-run diff to artifacts when executed remotely.
- Rollback plan: redeploy previous commit + reapply rollback migration to restore tables.
