---
task: reserve-bookingwizard-unused-var
timestamp_utc: 2025-12-05T15:44:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove unused `isSessionReady`

## Objective

Make `BookingWizard.tsx` lint-clean by removing the unused `isSessionReady` variable without changing behavior.

## Success Criteria

- [ ] `@typescript-eslint/no-unused-vars` warning in `BookingWizard.tsx` is resolved.
- [ ] Targeted lint on the file passes with `--max-warnings=0`.

## Architecture & Components

- File: `reserve/features/reservations/wizard/ui/BookingWizard.tsx`.
- Only adjust local variable usage; no component interface changes.

## Data Flow & API Contracts

- No API/props changes; hooks continue to provide `user` and `sessionStatus`.

## UI/UX States

- Not impacted.

## Edge Cases

- None; ensure no dependent logic used `isSessionReady` elsewhere (confirmed unused).

## Testing Strategy

- Run `pnpm eslint reserve/features/reservations/wizard/ui/BookingWizard.tsx --max-warnings=0`.

## Rollout

- No flags or rollout steps required.
