---
task: guest-ui-redesign
timestamp_utc: 2025-12-03T20:35:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
---

# Guest-Facing Routes Inventory (Public vs Authenticated)

## Public (no auth required)

- `/` — Marketing home (src/app/(public)/page.tsx)
- `/restaurants` — Restaurant directory (src/app/(public)/(marketing)/restaurants/page.tsx)
- `/restaurants/[slug]` — Restaurant detail (src/app/(public)/(marketing)/restaurants/[slug]/page.tsx)
- `/restaurants/[slug]/book` — Booking wizard entry (src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx)
- `/restaurants/[slug]/book/thank-you` — Post-booking confirmation (src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx)
- `/restaurants/[slug]/thank-you` — Alias thank-you page (src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx)
- `/bookings/[bookingId]` — Public booking detail (token-supported) (src/app/(public)/bookings/booking-page.tsx)
- `/bookings/[bookingId]/manage` — Manage booking (public token or auth) (src/app/(public)/bookings/[bookingId]/manage/page.tsx)
- `/bookings/[bookingId]/thank-you` — Confirmation page (src/app/(public)/bookings/[bookingId]/thank-you/page.tsx)
- `/auth/signin` — Auth entry (src/app/(public)/auth/signin/page.tsx)

## Authenticated Guest App (requires session)

- `/guest` → `/guest/dashboard` (alias) (src/app/guest/page.tsx)
- `/guest/dashboard` — Guest hub (src/app/guest/dashboard/page.tsx)
- `/guest/bookings` — Bookings list (src/app/guest/bookings/page.tsx)
- `/guest/bookings/[bookingId]` — Booking detail (authed view) (src/app/guest/bookings/[bookingId]/page.tsx)
- `/guest/bookings/[bookingId]/receipt` — Receipt/confirmation (src/app/guest/bookings/[bookingId]/receipt/page.tsx)
- `/guest/profile` — Profile/settings (src/app/guest/profile/page.tsx)
- `/guest/thank-you` — Generic thank-you (src/app/guest/thank-you/page.tsx)

## Shared Layouts / Shells

- Public/marketing shell: `src/components/layouts/MarketingLayout.tsx`
- Guest authenticated shell: `src/components/layouts/GuestLayout.tsx`
- Auth shell: `src/components/layouts/AuthLayout.tsx`
- Header/Footer: `components/layout/Header/Header.tsx`, `components/layout/Footer.tsx`

## Notes

- Feature flag: `FEATURE_GUEST_UI` / `NEXT_PUBLIC_FEATURE_GUEST_UI` controls new styling for all above.
- Deep-link safety: `/bookings/[bookingId]` supports token; `/guest/**` enforces redirect to `/auth/signin?redirectedFrom=...`.
