---
task: db-optimization-index-followups
timestamp_utc: 2026-02-07T16:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Plan: Index Follow-ups After Staging Hardening

## Objective

Ensure all high-value foreign keys have supporting btree indexes (or a documented, equivalent partial index), so FK checks and joins remain predictable as we scale to 50+ restaurants.

## Success Criteria

- [ ] `supabase db push --linked --dry-run` reports staging is up-to-date.
- [ ] FK-index audit shows no missing FK-supporting indexes for core OLTP tables, or intentional exceptions are documented (e.g., partial index for nullable FK).
- [ ] Migration is forward-only and safe to replay on production (staging-first evidence captured).

## Implementation Steps

- Add an additive migration that creates missing FK-supporting indexes using `CREATE INDEX IF NOT EXISTS`.
- Apply to staging using `supabase db push --linked --yes`.
- Verify with a catalog query that checks FK columns are index-backed:
  - Accept partial indexes for nullable FKs when predicate matches `col IS NOT NULL`.

## Rollout (Production)

- Apply during a change window if any index build could be long-running.
- Keep `statement_timeout` high enough to avoid partial application.
- Capture before/after index counts and any query improvements on representative workload.
