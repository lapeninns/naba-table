# Guest-facing CTAs and Link Audit

## Changes made (2025-11-24)

- Retargeted all guest-facing discovery CTAs to the live booking wizard for the default venue: `/restaurants/white-horse-pub-waterbeach/book`.
- Rebook CTA now routes directly to the booking wizard with the reservation’s restaurant slug (fallback to `white-horse-pub-waterbeach`) instead of the empty home page.
- Removed the placeholder "Saved" bottom-nav item that had no destination.
- Thank-you page fallbacks now send guests to the default venue booking flow instead of the missing `/restaurants` index.

## Remaining CTA map (guest-facing)

- Discovery / default entry: `/restaurants/white-horse-pub-waterbeach/book` (used by hero, empty states, favorites fallback, discovery tiles, collections, Next Steps browse, bottom-nav Search).
- Manage/return: `/guest/dashboard`, `/guest/bookings`, `/bookings/:id`, `/guest/profile`, `/auth/signin?...`.
- Booking detail actions: edit/cancel dialogs, download/share; rebook → `/restaurants/:slug/book?source=rebook&reservationId=:id` (fallback slug above).

## Notes

- No mocks added; uses existing default venue slug from config.
- If a dedicated browse/index page is added later, update these CTAs to point there.
