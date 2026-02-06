---
task: ops-bookings-a11y-touch
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Add shared search component `OpsBookingsSearchInput`
- [ ] Update `BookingsHeader` to use shared component
- [ ] Update `OpsBookingsClient` toolbar search to use shared component
- [ ] Set Ops search URL debounce to 200ms (from 500ms)
- [ ] Increase touch targets (mobile) for:
  - [ ] Details button
  - [ ] More actions button
  - [ ] Collapse toggle chevron
  - [ ] Status filter toggles and buttons
- [ ] Move `BookingOfflineBanner` into sticky `OpsPageToolbar` children
- [ ] Add skip link + focusable list target (`id="ops-bookings-list"`, `tabIndex=-1`)
- [ ] Add aria-live summary for “Showing X bookings”
- [ ] Raise minimum microcopy sizes (urgency badge, tiles)
- [ ] Run `pnpm typecheck` + `pnpm lint`
