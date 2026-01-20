---
task: fix-capacity-rules
timestamp_utc: 2026-01-20T10:16:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix capacity rules table missing

## Requirements

- Functional:
  - Restore `public.restaurant_capacity_rules` in production so `create_booking_with_capacity_check` and capacity lookups work.
  - Preserve expected constraints, indexes, triggers, RLS, and grants for capacity rules.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: RLS enabled with staff/service_role policies; no secrets in source.
  - Availability: production migration with rollback plan and backup reference.

## Existing Patterns & Reuse

- `server/booking/serviceFactory.ts` reads `restaurant_capacity_rules` (casted due to missing generated types).
- Capacity RPCs (`create_booking_with_capacity_check`, `update_booking_with_capacity_check`) query `restaurant_capacity_rules`.
- Consolidated schema in `backups/production_backup.sql` includes full DDL for the table, constraints, indexes, triggers, policies, and grants.

## External Resources

- Internal schema source: `backups/production_backup.sql` (consolidated_schema array literal).

## Constraints & Risks

- Production-only change per request; must verify PITR/backup reference before apply.
- `capacity_override_type` enum might also be missing if prior migration removed capacity schema.
- RLS/policies and trigger (`restaurant_capacity_rules_updated_at`) must be restored to avoid security regressions.

## Open Questions (owner, due)

- Which production backup/PITR reference should be used for rollback? (owner: user)
- Confirm whether `capacity_override_type` exists in production or needs re-creation. (owner: agent via Supabase MCP)

## Recommended Direction (with rationale)

- Recreate `public.restaurant_capacity_rules` using DDL from backup, including constraints, index, trigger, RLS, and grants.
- Create `public.capacity_override_type` enum if missing to satisfy column type.
- Run Supabase MCP dry-run diff, then apply migration to production, then smoke-test RPC.
