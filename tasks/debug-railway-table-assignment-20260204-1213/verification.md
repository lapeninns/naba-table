---
task: debug-railway-table-assignment
timestamp_utc: 2026-02-04T12:13:27Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes)

## Test Outcomes

- [x] Supabase read-only queries executed
- [x] Adjacency edges inserted for Railway tables (full mesh per zone).

## Artifacts

- Queries/results: `artifacts/db-check.json`, `artifacts/db-check-summary.txt`
- Adjacency apply: `artifacts/adjacency-apply-summary.json`, `artifacts/adjacency-apply-summary.txt`
- Post-check: `artifacts/adjacency-post-check.json`, `artifacts/adjacency-post-check.txt`

## Known Issues

- [ ] Private Zone `30F` has no adjacency entry (single-table zone; constraint prevents self-edge).

## Sign-off

- [ ] Engineering
