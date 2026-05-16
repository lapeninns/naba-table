# [BUG] Legacy thank-you redirect targets a non-existent route

**File:** [`next.config.js`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/next.config.js#L104-L108) (lines 104, 106, 108)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The `/thank-you?bookingId=...` redirect sends users to `/bookings/:bookingId/thank-you`, but the route tree contains no `/bookings/[bookingId]/thank-you` page. The only thank-you page found is `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`, so legacy completion links will redirect to a dead route rather than a usable booking confirmation page.

## Recommendation

Redirect to an existing booking route such as `/bookings/:bookingId` or `/guest/bookings/:bookingId/receipt`, or add a real `/bookings/[bookingId]/thank-you` handler that resolves the restaurant slug safely.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
