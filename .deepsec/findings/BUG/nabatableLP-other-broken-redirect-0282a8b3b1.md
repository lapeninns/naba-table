# [BUG] Legacy thank-you redirect points to a non-existent route

**File:** [`next.config.js`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/next.config.js#L104-L109) (lines 104, 107, 108, 109)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-broken-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The /thank-you redirect captures the bookingId query parameter and permanently redirects to /bookings/:bookingId/thank-you. I traced the app routes and found no matching /bookings/[bookingId]/thank-you route; the existing public booking detail route is /bookings/[bookingId], and the thank-you page exists under /restaurants/[slug]/book/thank-you. Normal legacy links will therefore land on a 404. The unbounded (?<bookingId>.\*) capture can also produce malformed same-origin paths, but I did not find an external open redirect.

## Recommendation

Redirect to an existing route such as /bookings/:bookingId, add the missing thank-you route, and constrain bookingId to the expected identifier format before interpolation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

The legacy `/thank-you?bookingId=` redirect now points at an existing route,
`/bookings/:bookingId/thank-you`, and the query capture is constrained to one
path segment with `(?<bookingId>[^/]+)`. The route then redirects to the
canonical guest receipt while preserving query parameters.

Evidence:

- `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx` exists.
- `tests/config/link-config.test.ts` verifies the redirect destination and
  constrained query capture.
- `tests/guest/public-booking-redirects.test.ts` verifies the legacy route
  redirects to `/guest/bookings/:bookingId/receipt` and preserves query params.
