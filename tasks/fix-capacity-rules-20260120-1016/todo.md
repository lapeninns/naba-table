---
task: fix-capacity-rules
timestamp_utc: 2026-01-20T10:16:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm existing DB patterns for capacity rules
- [ ] Confirm production backup/PITR reference
- [ ] Confirm `capacity_override_type` existence in production

## Core

- [ ] Draft migration for `restaurant_capacity_rules` + related policies/index/trigger
- [ ] Add conditional enum creation if missing
- [ ] Dry-run via Supabase MCP and save diff
- [ ] Apply migration to production via Supabase MCP

## Tests

- [ ] Verify table exists and constraints
- [ ] Smoke test RPC (safe)

## Notes

- Assumptions:
- Deviations:
  - Production-only apply requested; staging-first bypassed.

## Batched Questions

-
