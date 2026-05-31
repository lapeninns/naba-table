# [BUG] Pending-attention emails link to a non-existent public dashboard route

**File:** [`server/emails/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/emails/bookings.ts#L73-L672) (lines 73, 672)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-broken-ops-link`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The module derives bookingSiteUrl from getTrustedSiteOrigin(), which is explicitly the public/root host, then pending_attention emails set ctaUrl to `${bookingSiteUrl}/dashboard/bookings/${booking.id}`. Ops pages live under the app surface, and the reviewed route tree contains `src/app/app/(app)/dashboard/page.tsx` and `src/app/app/(app)/bookings/page.tsx`, but no shipped `/dashboard/bookings/[id]` public route. The proxy also lets root-host `/dashboard/...` fall through as public routing, so auto-assign failure emails can send staff to a dead route instead of the booking requiring manual action.

## Recommendation

Build this CTA from the trusted app origin and point it at an existing ops booking review route, for example an app-host bookings URL with a booking id/search parameter. Add a route/link regression test for pending_attention email output under the host split.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
