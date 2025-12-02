---
task: edit-booking-dialog-refactor
timestamp_utc: 2025-12-02T00:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Refactor EditBookingDialog

## Objective

Improve EditBookingDialog modularity using SOLID principles while keeping behavior/API unchanged for ops and guest flows.

## Success Criteria

- [ ] Props API unchanged; dialog still works in ops `/bookings` and guest reservation detail.
- [ ] Form logic separated into a dedicated hook/utilities; render tree simplified.
- [ ] Derived time/labels computed via pure helpers; no duplicate date math inside JSX.
- [ ] A11y/validation unaffected (same schema, disabled states, alerts).

## Architecture & Components

- `components/dashboard/EditBookingDialog.tsx`
  - Add `useEditBookingForm` internal hook to encapsulate RHF setup, derived values, submit handler, helpers.
  - Extract pure helpers for default values, interval, derived end time/duration labels.
  - Keep error copy + schema co-located but outside component.

## Data Flow & API Contracts

- No API changes. Continue calling `useUpdateBooking` (or injected hook) with same payload.

## UI/UX States

- Preserve existing alerts, disabled buttons, validation messages, loading states.

## Edge Cases

- Missing schedule metadata still blocks save.
- Invalid dates/intervals show same errors.

## Testing Strategy

- Manual smoke: open dialog, change time/party/notes, save; verify disabled state when untouched, error alert for invalid.
- Ensure guest flow still renders dialog.

## Rollout

- Direct; no flags.
