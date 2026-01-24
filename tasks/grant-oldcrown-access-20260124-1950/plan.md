---
task: grant-oldcrown-access
timestamp_utc: 2026-01-24T19:50:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Grant Old Crown access

## Objective

We will grant `oldcrown@lapeninns.com` access to the Old Crown restaurant in nabatable-pre-staging with the highest available role.

## Success Criteria

- [ ] User exists in pre-staging auth.
- [ ] Restaurant record found for “Old Crown”.
- [ ] Membership row inserted/updated with top role.

## Architecture & Components

- Data-only change via Supabase MCP SQL.

## Data Flow & API Contracts

- N/A (direct DB change).

## UI/UX States

- N/A.

## Edge Cases

- Email not found (user not invited).
- Restaurant name mismatch (multiple or none).
- Membership already exists (update role).

## Testing Strategy

- Verify membership row exists after insert.

## Rollout

- Immediate in pre-staging only.

## DB Change Plan (if applicable)

- Target envs: pre-staging only.
- Dry-run evidence: SQL select output captured in `verification.md`.
- Rollback plan: delete membership row if requested.
