---
task: grant-old-crown-girton-access
timestamp_utc: 2026-01-22T17:48:45Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Grant Old Crown Girton Access (Pre-staging)

## Objective

We will grant oldcrown@lapeninns.com access to the Old Crown Girton restaurant in pre-staging so that the account can manage that restaurant and no others.

## Success Criteria

- [ ] User has a `restaurant_memberships` row for Old Crown Girton.
- [ ] User has **no** other restaurant memberships in pre-staging.
- [ ] Role aligns with least-privilege or confirmed requirement.

## Architecture & Components

- No code changes; direct database update via Supabase MCP.

## Data Flow & API Contracts

- SQL DML only (if required):
  - Lookup user id by email.
  - Lookup restaurant id for Old Crown Girton.
  - Insert/update membership and delete other memberships.

## UI/UX States

- N/A.

## Edge Cases

- User email not found.
- Restaurant name/slug mismatch.
- User already has correct membership (no DML required).

## Testing Strategy

- Manual DB verification queries via Supabase MCP.

## Rollout

- Pre-staging only; no production impact.

## DB Change Plan (if applicable)

- Target env: pre-staging only.
- Backup reference: N/A (DML only, low risk).
- Dry-run evidence: capture SELECTs in `verification.md`.
- Rollback plan: re-insert prior memberships from captured pre-change query results.
