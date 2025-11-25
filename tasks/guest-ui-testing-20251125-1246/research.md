---
task: guest-ui-testing
timestamp_utc: 2025-11-25T12:46:06Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research

## Scope

Testing all guest‑facing routes (public and authenticated) on the local dev server `http://localhost:3000`.

## Pages / Routes

- `/` – Home page
- `/restaurants/[slug]` – Restaurant profile (use test slug)
- `/restaurants/[slug]/book` – Booking interface
- `/bookings/[bookingId]/thank-you` – Booking confirmation
- `/auth/signin` – Sign‑in page
- `/guest/dashboard` – Guest home (authenticated)
- `/guest/bookings` – Bookings list
- `/guest/bookings/[bookingId]` – Booking details
- `/guest/profile` – Profile settings

## Test Types

- Functional UI flows (navigation, forms, buttons, booking flow)
- Accessibility (WCAG 2.1 AA)
- Performance (Lighthouse – target scores)
- SEO (meta tags, headings, OG, structured data)
- Responsiveness (desktop 1920×1080, mobile Pixel 7 412×892)
- Custom business logic (booking date validation, form submissions)

## Success Criteria

- Lighthouse Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90
- Zero critical a11y violations
- All forms submit successfully with valid data
- All navigation links work
- No unexpected console errors
- Mobile viewport renders correctly

## Environment

- Local dev server at `http://localhost:3000`
- Uses remote Supabase test data

## Feature Flags

- Audit for any guest‑facing feature flags and ensure they are enabled for testing.

## Artifacts to Capture

- Desktop & mobile screenshots
- Lighthouse JSON reports
- HAR logs
- Console logs
- Accessibility audit results
- Failure videos (if any)
