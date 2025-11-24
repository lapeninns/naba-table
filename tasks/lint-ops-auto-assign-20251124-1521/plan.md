---
task: lint-ops-auto-assign
timestamp_utc: 2025-11-24T15:21:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Clean up lint warning in ops auto-assign loop

## Objective

Keep `scripts/ops-auto-assign-ultra-fast-loop.ts` functionally identical while removing the unused-variable ESLint warning so pre-commit passes without errors.

## Success Criteria

- [ ] `pnpm eslint scripts/ops-auto-assign-ultra-fast-loop.ts --max-warnings=0` passes locally.
- [ ] No functional change to booking cloning/assignment logic; signatures remain compatible for callers.

## Architecture & Components

- File: `scripts/ops-auto-assign-ultra-fast-loop.ts`
- Adjustment: avoid binding the unused `supabase` variable inside `cloneBooking`; keep parameter on the params object to preserve call contracts.

## Data Flow & API Contracts

- No API changes; script continues to call existing booking creation helpers.

## UI/UX States

- Not applicable (no UI change).

## Edge Cases

- Ensure removal does not strip `supabase` from the params object to prevent excess-property TypeScript issues at call sites.

## Testing Strategy

- Lint: `pnpm eslint scripts/ops-auto-assign-ultra-fast-loop.ts --max-warnings=0`.
- No additional unit/E2E needed due to no behavioral change.

## Rollout

- No flags; direct merge once lint passes.

## DB Change Plan

- Not applicable (no DB changes).
