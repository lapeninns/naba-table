# Research

## Summary

- Current Playwright coverage includes guest booking CRUD, guest profile CRUD, basic a11y audits, and visual regression for a small set of public pages.
- Guest/public route list in `guest-facing-routes.md` includes `/restaurants`, `/restaurants/[slug]/book/thank-you`, `/bookings/[bookingId]`, `/bookings/[bookingId]/thank-you`, `/guest/dashboard`, and legacy redirects (e.g. `/signin`, `/browse`, `/guest/bookings/[id]`, `/thank-you?bookingId=...`).
- `/restaurants/[slug]/book/thank-you` page renders `ReservationThankYouCard` and is accessible without params.
- Auth fixture supports authenticated `guestPage` and uses `E2E_GUEST_SESSION_TOKEN`.

## Gaps to cover

- Public discovery routes: `/restaurants` list, `/restaurants/[slug]` detail, `/restaurants/[slug]/book` entry, `/restaurants/[slug]/book/thank-you`.
- Public booking confirmation routes: `/bookings/[bookingId]` and `/bookings/[bookingId]/thank-you` (using an authenticated guest and a seed booking id).
- Guest portal routes: `/guest/dashboard`, `/guest/thank-you`.
- Redirect coverage for legacy routes: `/signin`, `/browse`, `/guest/bookings/[bookingId]`, `/thank-you?bookingId=...`.

## Constraints

- Avoid routes that do not exist (`/item/[slug]`, `/thank-you` without bookingId) to prevent false failures.
- Use stable selectors and avoid brittle assumptions; prefer heading/CTA presence + URL checks.
