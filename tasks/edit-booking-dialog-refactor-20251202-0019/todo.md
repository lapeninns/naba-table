---
task: edit-booking-dialog-refactor
timestamp_utc: 2025-12-02T00:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Read existing EditBookingDialog usages (ops + guest).

## Core

- [x] Introduce internal hook/helpers for form state and derived values.
- [x] Simplify JSX structure using helpers; keep props/API stable.
- [x] Ensure error handling and disabled logic preserved.

## UI/UX

- [ ] Validate a11y labels, focus flow, button states unchanged.

## Tests

- [ ] Manual smoke: open dialog, edit, save; check disabled when pristine/metadata missing.
- [ ] Guest view spot-check dialog render.

## Notes

- Keep schema and error copy intact.
