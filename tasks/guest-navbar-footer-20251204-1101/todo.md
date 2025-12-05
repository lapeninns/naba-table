---
task: guest-navbar-footer
timestamp_utc: 2025-12-04T11:08:30Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Wire `CustomerNavbar` into `GuestLayout` behind `guestUi` flag
- [x] Ensure layouts expose `main#main-content` where skip link lands

## Core

- [x] Update footer to be auth-aware and align links with guest shell
- [x] Keep legacy header/footer path intact for `guestUi=false`

## UI/UX

- [x] Verify sticky nav + mobile drawer behaviours
- [x] Confirm focus states and skip link targeting `#main-content`
- [x] Check responsive spacing at 360/768/1280 widths

## Tests

- [x] Manual Chrome DevTools QA on `/guest/thank-you` (logged-out)
- [x] Spot-check `/` marketing page for layout/skip-link

## Notes

- Assumptions: marketing keeps same shell but adds skip target; auth-aware footer hides sign-in when logged in.
- Deviations: None yet.

## Batched Questions

- Should marketing adopt `CustomerNavbar`? (Assuming no; limiting scope to guest layout.)
