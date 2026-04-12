---
task: stack-party-time-fields
timestamp_utc: 2026-04-11T20:40:50Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP
Surface: `http://localhost:3000/dev/ops-bookings?restaurantId=11111111-1111-4111-8111-111111111111`
Why this surface: existing dev harness for the canonical `EditBookingDialog` consumer of `ScheduleAwareTimestampPicker`
Interaction verified: opened a booking's `Edit Booking` dialog from the ops bookings harness and confirmed date, party size, and time render as vertically stacked panels in that order

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract
- The harness still logs schedule-loading `404` errors for `dev-restaurant` (`Restaurant not found`) and matching calendar-mask warnings. This is a pre-existing harness data issue, not a regression from the layout change.

### DOM & Accessibility

- [x] Semantic HTML verified
- [x] ARIA attributes correct
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed
- Measured label positions in DevTools after opening the dialog:
  - `Date` top `277`
  - `Party size` top `415`
  - `Time` top `568`
- These increasing `top` values confirm the fields now stack on separate rows on desktop.

### Performance (profiled; mobile; 4× CPU; 4G)

- Not required for this low-risk layout-only dialog adjustment.

### Device Emulation

- [x] Desktop verified

## Test Outcomes

- [x] `pnpm exec eslint 'src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx'`

## Artifacts

- Screenshot: `artifacts/edit-booking-dialog-stacked-layout.png`

## Known Issues

- [x] Dev harness schedule/calendar mask fetches still 404 for `dev-restaurant`, which keeps time availability disabled in this surface.

## Sign-off

- [x] Engineering
