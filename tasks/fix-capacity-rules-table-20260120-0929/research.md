---
task: fix-capacity-rules-table
timestamp_utc: 2026-01-20T09:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restore restaurant_capacity_rules table

## Requirements

- Functional:
  - Ensure booking RPC / capacity checks no longer fail due to missing public.restaurant_capacity_rules.
  - Provide a stable schema for restaurant capacity rules used by server booking flow.
  - Apply migration to staging, then production, with verification.
- Non-functional (a11y, perf, security, privacy, i18n):
  - DB safety: remote-only, staging-first, rollback plan, avoid long locks.
  - Security: no secrets in repo, no manual local DB operations.

## Existing Patterns & Reuse

- Booking capacity logic reads `restaurant_capacity_rules` in `server/booking/serviceFactory.ts`.
- Supabase migrations live in `supabase/migrations/` and use `CREATE ... IF NOT EXISTS`, comments, and explicit rollback notes.
- Updated-at triggers exist in the database (see external backup archive; file removed from repo), but there are no recent migrations for them.
- Staging check: `public.restaurant_capacity_rules` does not exist (42P01 relation does not exist).

## External Resources

- None required yet. (DeepWiki/Context7 not available in this environment.)

## Constraints & Risks

- Supabase is remote-only; staging must succeed before production.
- Staging/prod migration histories are identical, so table is missing in both unless manually created.
- Access to Supabase MCP requires a valid access token and project IDs.

## Open Questions (owner, due)

- Q: What are the staging and production Supabase project IDs for this repo? (owner: github:@maintainers)
- Q: Can you provide a Supabase access token via `SUPABASE_ACCESS_TOKEN` for MCP? (owner: github:@maintainers)

## Recommended Direction (with rationale)

- Create a new migration adding `public.restaurant_capacity_rules` with FK constraints to `restaurants` and `restaurant_service_periods`, optional scope columns, and indexing for the query pattern. This restores the missing table without changing runtime code.
