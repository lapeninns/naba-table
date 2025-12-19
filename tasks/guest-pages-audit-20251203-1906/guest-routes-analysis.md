---
task: guest-pages-audit
timestamp_utc: 2025-12-03T19:07:59Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Guest-Facing Routes — Protection & 404 Check (as of 2025-12-03)

## Method

- Used `RouteScanner` against `src/app` (artifacts: `artifacts/route-scan.json`, `artifacts/route-map-ascii.txt`, `artifacts/route-map-mermaid.md`).
- Inspected auth gating via `src/middleware.ts` (no guest-route guard), segment layouts, and per-page logic (Supabase `getUser()` redirects).
- Compared against existing `guest-facing-routes.md` to flag outdated entries.

## Route Catalogue

| Path                                | Category                | Protection                                        | Source                                                                    | Notes / Flow                                                                                                                  |
| ----------------------------------- | ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`                                 | Marketing landing       | Unprotected                                       | `src/app/(public)/page.tsx`                                               | Hero + CTA to restaurants; no auth logic.                                                                                     |
| `/restaurants`                      | Discovery list          | Unprotected                                       | `src/app/(public)/(marketing)/restaurants/page.tsx`                       | Entry to browse restaurants.                                                                                                  |
| `/restaurants/:slug`                | Restaurant detail       | Unprotected                                       | `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`                | Shows restaurant info; dynamic slug.                                                                                          |
| `/restaurants/:slug/book`           | Booking flow            | Unprotected                                       | `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`           | Booking UI; dynamic slug; no auth required.                                                                                   |
| `/restaurants/:slug/book/thank-you` | Booking confirmation    | Unprotected                                       | `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` | Post-booking confirmation; no auth required.                                                                                  |
| `/auth/signin`                      | Auth                    | Unprotected                                       | `src/app/(public)/auth/signin/page.tsx`                                   | Login entry; used as redirect target from protected pages.                                                                    |
| `/bookings/:bookingId`              | Booking detail          | **Token-or-auth**                                 | `src/app/(public)/bookings/[bookingId]/page.tsx`                          | If no Supabase user **and** no `?token=`, redirects to `/auth/signin?redirectedFrom=/bookings/:id`; otherwise renders detail. |
| `/bookings/:bookingId/thank-you`    | Booking confirmation    | Unprotected                                       | `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`                | Static confirmation page.                                                                                                     |
| `/guest`                            | Guest portal index      | Protected                                         | `src/app/guest/page.tsx`                                                  | Immediately redirects to `/guest/dashboard`, which requires auth.                                                             |
| `/guest/dashboard`                  | Guest home              | Protected                                         | `src/app/guest/dashboard/page.tsx`                                        | Supabase `getUser()` gate → redirect to `/auth/signin?redirectedFrom=/guest/dashboard`.                                       |
| `/guest/bookings`                   | Guest bookings list     | Protected                                         | `src/app/guest/bookings/page.tsx`                                         | Supabase `getUser()` gate → redirect to `/auth/signin?redirectedFrom=/guest/bookings`.                                        |
| `/guest/bookings/:bookingId`        | Guest booking deep link | Redirects to `/bookings/:id` (then token-or-auth) | `src/app/guest/bookings/[bookingId]/page.tsx`                             | Immediate `permanentRedirect` to public detail URL.                                                                           |
| `/guest/profile`                    | Profile                 | Protected                                         | `src/app/guest/profile/page.tsx`                                          | Supabase `getUser()` gate → redirect to `/auth/signin?redirectedFrom=/guest/profile`.                                         |
| `/guest/thank-you`                  | Generic thank-you       | Unprotected                                       | `src/app/guest/thank-you/page.tsx`                                        | Static confirmation; accessible without auth.                                                                                 |

## 404 / Stale Entries

- **Not present now:** `/thank-you` (root), `/item/[slug]`, `/bookings` (list). These appear in legacy `guest-facing-routes.md` but have no `page.tsx` today → would 404 unless redirected elsewhere.
- Legacy redirects listed in `guest-facing-routes.md` (e.g., `/signin`, `/guest/browse`) are not implemented in App Router; rely on previous system or would 404 without middleware support.

## Protection Summary

- **Protected (auth required):** `/guest/dashboard`, `/guest/bookings`, `/guest/profile`, `/guest` (via redirect). Enforcement via server-side Supabase check and redirect to `/auth/signin` with `redirectedFrom` query.
- **Token-or-auth:** `/bookings/:bookingId` (renders when either logged in or holding `?token=`); redirects to sign-in otherwise.
- **Unprotected:** marketing/discovery (`/`, `/restaurants`, `/restaurants/:slug`), booking UI/thank-you (`/restaurants/:slug/book`, `/restaurants/:slug/book/thank-you`, `/bookings/:id/thank-you`, `/guest/thank-you`), auth page (`/auth/signin`).

## Flow Snapshots

- **Booking flow (unauthenticated):** `/restaurants/:slug` → `/restaurants/:slug/book` → submit → `/bookings/:id/thank-you` (public) → manage link may lead to `/bookings/:id` (requires token) or `/guest/bookings` (requires auth).
- **Guest portal flow (authenticated):** `/guest` → `/guest/dashboard` → `/guest/bookings` → `/bookings/:id` (already authed) → optional `/guest/profile` for account edits.
- **Auth enforcement:** No global guest-route middleware; per-page Supabase `getUser()` checks handle protection and redirect with `redirectedFrom` hints.

## Verification Notes

- All listed routes have corresponding `page.tsx` files (see Source column) and were discovered by `RouteScanner`; expected to render (no 404) when files remain in place.
- Any route not in the table lacks a page file and would fall through to `not-found`/404 in the current App Router build.
