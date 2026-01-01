---
task: responsiveness-fixes
timestamp_utc: 2026-01-01T15:14:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate components for booking/customer header actions and floor-plan table buttons
- [x] Locate new-bookings form fields/labels with console warnings

## Core

- [x] Enforce 44x44px touch targets on mobile for primary actions
- [x] Fix label/id/name mismatches in new-bookings form
- [x] Reduce Supabase auth user polling to avoid 429 rate limits
- [x] Remove preload warnings by eager-loading wizard steps

## UI/UX

- [x] Verify layouts at 375/768/1024/1440

## Tests

- [x] Chrome DevTools MCP manual QA + screenshots + console log

## Notes

- Assumptions: Skip links remain under 44px and are not treated as primary actions.
- Deviations: None

## Batched Questions

- Confirm if sidebar icon sizing should change on tablet/desktop.
