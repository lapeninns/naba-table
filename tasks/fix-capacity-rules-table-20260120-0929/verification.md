---
task: fix-capacity-rules-table
timestamp_utc: 2026-01-20T09:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## DB Checks (staging)

- [ ] Table exists: public.restaurant_capacity_rules
- [ ] Columns and types verified
- [ ] Indexes verified

## DB Checks (production)

- [ ] Table exists: public.restaurant_capacity_rules
- [ ] Columns and types verified
- [ ] Indexes verified

## Application Checks

- [ ] Booking capacity query succeeds
- [ ] No capacity_rule_query_failed logs

## Artifacts

- Dry-run diff: `tasks/fix-capacity-rules-table-20260120-0929/artifacts/db-diff.txt`
- Schema checks: `tasks/fix-capacity-rules-table-20260120-0929/artifacts/schema-checks.txt`

## Known Issues

- [ ] DB verification blocked in this environment due to DNS/MCP auth; requires user-run SQL checks.
