---
task: reset-zones-seed
timestamp_utc: 2025-11-26T00:23:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Database seed

- Pending execution in target environment; run via psql with Supabase DB URL.
- No UI changes; Chrome DevTools MCP not applicable here.

## Test Outcomes

- [ ] Zone count matches expected (4 zones).
- [ ] Table counts per zone/mobility match requested layout.
- [ ] Booking creation smoke test passes (staging).

## Artifacts

- To be captured after execution (SQL output, SELECT results, screenshots if needed).

## Known Issues

- None observed yet; execution not performed in this workspace.

## Sign-off

- Pending after remote run.
