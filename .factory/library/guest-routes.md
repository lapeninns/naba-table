# Guest Routes

Canonical guest/public/auth route ownership and redirect notes for this mission.

---

## Route Groups

- Marketing / discovery: `/`, `/restaurants/**`
- Guest auth: `/auth`, `/auth/signin`
- Public booking lifecycle: `/bookings/**`, `/restaurants/[slug]/book/**`
- Guest portal: `/guest/**`

## Canonicalization Rules

- `/guest` resolves to the dashboard experience.
- `/guest/thank-you` is deprecated and canonicalizes to `/bookings` rather than remaining a primary destination or guest-portal landing page.
- `/bookings/[bookingId]/manage` canonicalizes to `/bookings/[bookingId]`.
- `/bookings/[bookingId]/thank-you` canonicalizes to `/guest/bookings/[bookingId]/receipt`.
- `/restaurants/[slug]/thank-you` canonicalizes to `/restaurants/[slug]/book/thank-you`.
- Tokenized public booking links normalize through `/bookings/recover` before landing on the final internal destination.

## Auth / Redirect Rules

- Protected guest routes redirect to `/auth/signin` with a safe `redirectedFrom` value.
- `redirectedFrom` must stay same-site and within approved prefixes only.
- Authenticated visits to `/auth` should canonicalize to the correct signed-in destination (`/guest/dashboard` or `/app` as appropriate).
- Root-host sign-in flows with app-owned intent should hand off to app-host sign-in.

## Host Ownership Rules

- Guest-owned routes should not live on the app host.
- App-owned `/app/*` routes opened on the root host should canonicalize to the app host.

## Validation Note

If multi-host behavior cannot be exercised in live browser validation, workers should add or update deterministic automated coverage and document the runtime limitation in their handoff.
