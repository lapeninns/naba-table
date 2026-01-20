---
task: fix-capacity-rules-table
timestamp_utc: 2026-01-20T09:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm staging/prod project IDs.
- [ ] Supabase MCP access token available (using CLI instead).
- [x] Inspect staging schema for existing restaurant_capacity_rules.

## Core

- [x] Draft migration to create restaurant_capacity_rules with constraints/indexes/comments.
- [ ] Capture dry-run diff artifact (blocked by remote migration history mismatch).
- [ ] Apply migration to staging and verify.
- [ ] Apply migration to production and verify.

## Tests

- [ ] Validate booking capacity query succeeds.
- [ ] Confirm fallback behavior when table is empty.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Staging/prod project IDs?
- Supabase access token available?
