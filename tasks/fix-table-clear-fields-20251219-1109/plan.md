---
task: fix-table-clear-fields
timestamp_utc: 2025-12-19T11:10:33Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Restore clearing semantics on table updates

## Objective

Ensure table update requests can clear stored `position` and `notes` by sending explicit `null` values.

## Success Criteria

- [ ] Update payload always sends `null` for `position`/`notes` when values are cleared or omitted.
- [ ] Existing create payload behavior remains unchanged.

## Architecture & Components

- `src/services/ops/tables.ts`: normalize update payload fields for `position` and `notes`.

## Data Flow & API Contracts

- PATCH `/api/tables/:id` receives `position` and `notes` explicitly set to `null` when cleared.

## UI/UX States

- No UI changes.

## Edge Cases

- Callers that omit `position`/`notes` may now clear them; confirm no other call sites.

## Testing Strategy

- No automated tests added (scope). Document if tests are not run.

## Rollout

- Standard deploy; no flags.

## DB Change Plan (if applicable)

- None.
