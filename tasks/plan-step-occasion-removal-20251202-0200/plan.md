---
task: plan-step-occasion-removal
timestamp_utc: 2025-12-02T02:00:26Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove occasion from plan step

## Objective

Remove the occasion input from the booking plan step and surface notes outside the accordion while keeping date/time/party flows intact.

## Success Criteria

- Occasion selector no longer appears anywhere in the plan step UI.
- Accordion summary and copy no longer reference occasion; notes are always visible outside the accordion.
- Form submission works without user-provided occasion; time/date/party validation unchanged.
- Tests covering the plan step are updated to reflect the new UI.

## Architecture & Components

- `reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx`: Remove `OccasionPicker`, move `NotesField` out of the accordion, adjust summary/copy.
- `reserve/features/reservations/wizard/model/schemas.ts`: Make `bookingType` optional/non-required to avoid validation failures.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts`: Keep automatic bookingType inference; remove handler/state pieces tied to manual occasion selection; ensure submit uses inferred value or default.
- Tests under `reserve/features/reservations/wizard/ui/__tests__` as needed.

## Data Flow & Contracts

- `bookingType` continues to be derived from time selection (`inferBookingOption`) and stored in state, but user cannot edit it; validation treats it as optional.

## UI/UX States

- Accordion header shows time summary only (no occasion/notes mention).
- Notes field rendered below accordion; retains error display.
- Loading/empty/error states for time/date remain unchanged.

## Edge Cases

- No available time slots: summary should still handle missing time gracefully.
- Notes optional; empty string handled without errors.

## Testing Strategy

- Update/adjust existing Jest tests that assert on accordion summary or occasion picker presence.
- Manual sanity check rendering if time allows (cannot guarantee MCP DevTools availability here; note in verification).

## Rollout

- No flags; small UI tweak. Verify locally and prepare for PR with task folder reference.
