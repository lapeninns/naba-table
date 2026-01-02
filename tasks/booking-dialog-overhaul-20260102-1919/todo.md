---
task: booking-dialog-overhaul
timestamp_utc: 2026-01-02T19:19:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Create new dialog subcomponents (DialogHeader, GuestProfilePanel).
- [ ] Confirm TableAssignmentPanel integration path.

## Core

- [ ] Refactor BookingDialog layout to use new panels and status styling.
- [ ] Add keyboard shortcuts (Cmd/Ctrl+Enter, Esc) scoped to open state.
- [ ] Implement WhatsApp action for guest phone with digits-only URL.

## Table Management

- [ ] Add Smart Assign button (tightest available fit) in TableAssignmentPanel.
- [ ] Add Perfect Fit + Available filters.
- [ ] Add conflict timeline bar for table.status === 'conflicted'.

## UI/UX

- [ ] Ensure responsive layout stacks panels below 768px.
- [ ] Verify a11y roles, focus, and readable labels.

## Tests

- [ ] Run lint, typecheck, and test scripts.

## Notes

- Assumptions: Booking data lacks guest.tags; use loyalty/allergies/dietaryRestrictions as tags.
- Deviations:

## Batched Questions

- Confirm service window fallback for timeline bar.
