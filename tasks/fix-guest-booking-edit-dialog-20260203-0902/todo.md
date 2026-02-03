---
task: fix-guest-booking-edit-dialog
timestamp_utc: 2026-02-03T09:02:53Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify all call sites for `EditBookingDialog` (guest + ops).
- [x] Confirm ops hook usage in `components/dashboard/EditBookingDialog.tsx`.

## Core

- [x] Refactor `EditBookingDialog` into base + guest/ops exports.
- [x] Keep call sites unchanged by switching on `mode` within dialog.

## UI/UX

- [ ] Ensure dialog opens in guest booking detail without provider errors.
- [ ] Ensure ops dialogs continue to function.

## Tests

- [ ] Manual QA via Chrome DevTools MCP (guest + ops) (blocked: booking detail redirects without token/cookie).

## Notes

- Assumptions:
  - Ops flows are correctly wrapped with `OpsServicesProvider`.
- Deviations:
  - None.

## Batched Questions

- None.
