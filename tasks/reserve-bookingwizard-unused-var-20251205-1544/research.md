---
task: reserve-bookingwizard-unused-var
timestamp_utc: 2025-12-05T15:44:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix unused variable lint warning in BookingWizard

## Requirements

- Functional: Clear the `@typescript-eslint/no-unused-vars` warning for `isSessionReady` in `reserve/features/reservations/wizard/ui/BookingWizard.tsx` so `eslint --max-warnings=0` passes.
- Non-functional: No behavior change to the Booking Wizard.

## Existing Patterns & Reuse

- The wizard already uses `sessionStatus` and `user` from `useSupabaseSession`; other flags derive from those.
- Lint rule is standard; prior code paths gate UI with `isAuthenticated` and `shouldLockContacts`.

## External Resources

- None needed; relying on existing hook contracts.

## Constraints & Risks

- Node engine mismatch warning (repo wants 20.11.1, current 22.12.0) may still appear but lint should run.
- Must avoid altering session-dependent logic.

## Open Questions (owner, due)

- None for this scope.

## Recommended Direction (with rationale)

- Remove the unused `isSessionReady` variable; all logic already uses `sessionStatus`/`isAuthenticated`. This is the smallest change with zero runtime impact.
