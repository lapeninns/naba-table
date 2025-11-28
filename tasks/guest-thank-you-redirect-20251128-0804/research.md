---
task: guest-thank-you-redirect
timestamp_utc: 2025-11-28T08:04:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Guest Thank-You Redirect

## Requirements

- After the guest booking flow completes, redirect users to `/guest/thank-you` whether the booking is pending or confirmed.
- Create a guest-facing thank-you page that includes CTAs to manage bookings and to return home.

## Existing Patterns & Reuse

- Booking wizard return path defaults to `/thank-you` via `ReservationWizardClient` and the wizard hooks (`safeReturnPath` fallback).
- Existing thank-you pages already exist at `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` and `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx` with CTA patterns we can mirror.
- Guest area uses `GuestLayout` (`src/components/layouts/GuestLayout.tsx`) for consistent header/footer.

## External Resources

- None needed; reuse in-repo patterns for thank-you pages.

## Constraints & Risks

- Must keep accessibility (focusable buttons/links, semantic headings).
- Ensure redirect path change does not affect ops/walk-in wizard (`returnPath` is overridden there).

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Add a new page at `src/app/guest/thank-you/page.tsx` using `GuestLayout`, mirroring existing thank-you CTAs (Manage bookings → `/guest/bookings`, Home → `/`).
- Point the guest booking flow (`ReservationWizardClient` default returnPath) to `/guest/thank-you` so both pending and confirmed flows land there.
- Update sitemap/route docs if the path list references `/thank-you` to keep discoverability.
