---
task: index-hygiene
timestamp_utc: 2026-02-07T14:41:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report (Template): Index Hygiene — Staging

## Manual Execution Context

- Target: staging database only
- Script:
  - `tasks/index-hygiene-20260207-1441/artifacts/index_hygiene_public.sql`

## Preflight

- [ ] Planned drops are not backing constraints (0 rows returned)
- [ ] Baseline counts captured

## Post-Apply Verification

- [ ] Missing FK supporting indexes count = 0
- [ ] Duplicate groups (exact) = 0 rows
- [ ] Duplicate groups (ignoring uniqueness) = 0 rows

## Notes / Anomalies

- (fill in during staging run)
