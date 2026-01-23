---
task: grant-oldcrown-access
timestamp_utc: '2026-01-22T23:57:47Z'
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Grant Oldcrown Access

## Objective

We will grant oldcrown@lapeninns.com membership to the Oldcrown restaurant so they can access restaurant tools.

## Success Criteria

- [ ] SQL resolves the user ID and restaurant ID.
- [ ] Membership insert is idempotent and uses a valid role.
- [ ] CLI usage notes target nabatable-pre-staging.

## Architecture & Components

- Data change only: `public.restaurant_memberships` insert.

## Data Flow & API Contracts

- N/A (manual SQL execution via CLI).

## UI/UX States

- N/A.

## Edge Cases

- User not found by email.
- Restaurant slug not found.
- Membership already exists.

## Testing Strategy

- Manual SQL SELECT checks before/after.

## Rollout

- Execute once in nabatable-pre-staging; no feature flag.

## DB Change Plan (if applicable)

- Target env: nabatable-pre-staging (remote only).
- Backup/rollback: delete membership row if needed.
