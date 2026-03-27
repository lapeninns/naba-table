---
task: email-intents-db-rollout
timestamp_utc: 2026-03-27T09:46:35Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Email Intents DB Rollout

## Requirements

- Functional:
  - Apply `supabase/migrations/20260327090000_add_email_dispatch_intents.sql` to staging first.
  - Validate the new table and claim RPC on staging.
  - Promote the same schema change to production only after staging validation.
- Non-functional:
  - Keep rollout production-safe with explicit environment targeting.
  - Preserve Supabase migration history metadata so future forward-only migration flows remain consistent.

## Existing Patterns & Reuse

- `docs/db/supabase-baseline-migrations.md` defines the required staging-first, forward-only migration model.
- The linked Supabase MCP target is staging (`ndxmivcrehsacuerwxtm`), confirmed in prior task evidence.
- Production is known to be `vrdiqfudmwydclqpydee` from prior rollout tasks and env files.

## Constraints & Risks

- Supabase MCP `apply_migration` is unavailable in this session (`UnauthorizedException: Migrations endpoint is not generally available yet`).
- Local `supabase` CLI is not installed in this workspace.
- Production direct Postgres authentication via `.env.vercel-production.live` is currently failing even when reconstructing connection strings with `SUPABASE_DB_PASSWORD`.
- No Supabase Management API token is available in the environment, so the Management API SQL endpoint cannot be used from this session.
- Raw SQL fallback requires explicit `supabase_migrations.schema_migrations` metadata updates to avoid future migration drift.

## Findings

- Staging rollout succeeded via Supabase MCP `execute_sql` fallback:
  - `public.email_dispatch_intents` exists.
  - `public.claim_due_email_dispatch_intents(integer, text[])` exists and returns `0` rows cleanly on empty state.
  - Migration version `20260327090000` is now recorded in `supabase_migrations.schema_migrations` on staging.
- Production rollout succeeded via Supabase Management API:
  - `POST /v1/projects/vrdiqfudmwydclqpydee/database/query` accepted the repo migration SQL and metadata insert.
  - `public.email_dispatch_intents` now exists on production.
  - `public.claim_due_email_dispatch_intents` now exists on production.
  - Migration version `20260327090000` is now recorded in `supabase_migrations.schema_migrations` on production.
  - `service_role` has `EXECUTE` privilege on `public.claim_due_email_dispatch_intents(integer, text[])`.

## Recommended Direction

- Treat both staging and production schema rollout as complete for migration `20260327090000`.
- Follow up separately on consolidating the older duplicate migration version prefixes in `supabase/migrations/` so future CLI-based migration flows are safe again.
