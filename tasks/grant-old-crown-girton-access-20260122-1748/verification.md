---
task: grant-old-crown-girton-access
timestamp_utc: 2026-01-22T17:48:45Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable (no UI change).

## Test Outcomes

- DB verification queries executed via Supabase Management API (pre-staging project).
- Membership role updated to `owner` in pre-staging.

## Findings (Pre-staging)

- Supabase project ref: `loxrwkeuxesctnrdpksy` (nabatable-pre-staging).
- User: `oldcrown@lapeninns.com` → `b9afc366-0b44-48cc-af91-3a9062df9fd0`.
- Profile: `has_access = true`.
- Restaurant: `The Old Crown Girton` → `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c` (active).
- Memberships for user:
  - `The Old Crown Girton` (role: `owner`).
- No other memberships found.

## Staging cross-check (troubleshooting)

- Supabase project ref: `rrpeokmfbtbrirqjprpe` (nabatable-staging).
- Profile: `has_access = true`.
- Memberships for user:
  - `The Old Crown Girton` (role: `manager`).

## Artifacts

- Query outputs captured in chat logs (no file artifacts produced).

## Known Issues

- Supabase MCP target did not switch in-session; verification performed via Management API.
