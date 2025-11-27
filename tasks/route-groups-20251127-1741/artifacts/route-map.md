# Route Map (post `(public)` grouping)

## Domain & Middleware Model

- **Root domain (`{ROOT_DOMAIN}` e.g. `sajiloreserve.com` / `localhost`)** serves public + guest routes; middleware redirects `/app*` and `/ops*` on root to the app subdomain.
- **App subdomain (`app.{ROOT_DOMAIN}`)** serves restaurant portal; middleware rewrites requests to `/app/*` internally and normalizes accidental `/app/app` prefixes.
- **API** lives under `/api/**`; ops APIs are rewritten to `/api/ops/*` when called on the app subdomain.

## Route Groups

- `(public)` — organizational only; URLs unchanged. Contains landing, auth, public bookings, marketing booking flow.
- `guest` — authenticated guest area (on root domain).
- `app` with `(app)` group — authenticated restaurant portal (on app subdomain).

## Public (no auth required; root domain)

| URL path                             | Purpose                                                                  | File                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `/`                                  | Marketing landing + CTA to book/sign in                                  | `src/app/(public)/page.tsx`                                               |
| `/auth/signin`                       | Guest sign-in form (redirects authenticated users to `/guest/dashboard`) | `src/app/(public)/auth/signin/page.tsx`                                   |
| `/auth/signup`                       | Guest sign-up                                                            | `src/app/(public)/auth/signup/page.tsx`                                   |
| `/auth/forgot-password`              | Password reset flow                                                      | `src/app/(public)/auth/forgot-password/page.tsx`                          |
| `/bookings/[bookingId]`              | Public booking detail via magic link/token                               | `src/app/(public)/bookings/[bookingId]/page.tsx`                          |
| `/bookings/[bookingId]/thank-you`    | Confirmation page after booking                                          | `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`                |
| `/restaurants/[slug]/book`           | Marketing booking wizard for a restaurant                                | `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`           |
| `/restaurants/[slug]/book/thank-you` | Thank-you after marketing booking                                        | `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` |

## Guest (authenticated on root domain)

| URL path                      | Purpose                            | File                                          |
| ----------------------------- | ---------------------------------- | --------------------------------------------- |
| `/guest`                      | Entry/redirect page for guest area | `src/app/guest/page.tsx`                      |
| `/guest/dashboard`            | Guest dashboard overview           | `src/app/guest/dashboard/page.tsx`            |
| `/guest/bookings`             | List of guest’s bookings           | `src/app/guest/bookings/page.tsx`             |
| `/guest/bookings/[bookingId]` | Guest booking detail               | `src/app/guest/bookings/[bookingId]/page.tsx` |
| `/guest/profile`              | Guest profile/settings             | `src/app/guest/profile/page.tsx`              |

## Restaurant Portal (authenticated on app subdomain; URLs still start with `/app`)

| URL path                                   | Purpose                       | File                                                             |
| ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| `/app/auth/signin`                         | Restaurant staff sign-in      | `src/app/app/auth/signin/page.tsx`                               |
| `/app`                                     | Portal root (dashboard shell) | `src/app/app/(app)/page.tsx`                                     |
| `/app/dashboard`                           | Dashboard overview            | `src/app/app/(app)/dashboard/page.tsx`                           |
| `/app/bookings`                            | Bookings management           | `src/app/app/(app)/bookings/page.tsx`                            |
| `/app/walk-in`                             | Walk-in flow                  | `src/app/app/(app)/walk-in/page.tsx`                             |
| `/app/seating`                             | Seating overview              | `src/app/app/(app)/seating/page.tsx`                             |
| `/app/seating/floor-plan`                  | Floor plan editor/view        | `src/app/app/(app)/seating/floor-plan/page.tsx`                  |
| `/app/seating/capacity`                    | Capacity planner              | `src/app/app/(app)/seating/capacity/page.tsx`                    |
| `/app/analytics`                           | Analytics overview            | `src/app/app/(app)/analytics/page.tsx`                           |
| `/app/analytics/rejections`                | Rejection analytics           | `src/app/app/(app)/analytics/rejections/page.tsx`                |
| `/app/management`                          | Ops management home           | `src/app/app/(app)/management/page.tsx`                          |
| `/app/management/team`                     | Team management               | `src/app/app/(app)/management/team/page.tsx`                     |
| `/app/customers`                           | Customer list                 | `src/app/app/(app)/customers/page.tsx`                           |
| `/app/settings`                            | Settings hub                  | `src/app/app/(app)/settings/page.tsx`                            |
| `/app/settings/tables`                     | Table settings                | `src/app/app/(app)/settings/tables/page.tsx`                     |
| `/app/settings/restaurant`                 | Restaurant settings home      | `src/app/app/(app)/settings/restaurant/page.tsx`                 |
| `/app/settings/restaurant/profile`         | Restaurant profile            | `src/app/app/(app)/settings/restaurant/profile/page.tsx`         |
| `/app/settings/restaurant/service-periods` | Service periods               | `src/app/app/(app)/settings/restaurant/service-periods/page.tsx` |
| `/app/settings/restaurant/operating-hours` | Operating hours               | `src/app/app/(app)/settings/restaurant/operating-hours/page.tsx` |
| `/app/settings/restaurant/occasions`       | Occasion config               | `src/app/app/(app)/settings/restaurant/occasions/page.tsx`       |
| `/app/settings/restaurant/team`            | Restaurant team               | `src/app/app/(app)/settings/restaurant/team/page.tsx`            |

## API Overview (shared)

- All API handlers reside under `src/app/api/**` and are reachable on both domains.
- Middleware rewrites `app.<domain>/api/{service}` to `app.<domain>/api/ops/{service}` for ops services (`bookings`, `customers`, `dashboard`, `restaurants`, `settings`, `strategies`, `tables`, `team`, `zones`, etc.) except when explicitly public (e.g., restaurant schedule/calendar-mask).
- Key families include:
  - `api/auth/*` (auth callbacks, sign-in)
  - `api/bookings/*` (public booking detail/confirm/history)
  - `api/availability`, `api/restaurants/[slug]/(schedule|calendar-mask)` (public availability)
  - `api/ops/**` (restaurant ops, reserved for app subdomain users)
  - `api/profile`, `api/team/invitations/*`, `api/events`, `api/webhook/resend`, test endpoints under `api/test/**`.

## Notes

- Route groups `(public)` and `(app)` are organizational only—paths above reflect actual URLs.
- Middleware enforces canonical host: root domain for public/guest, app subdomain for restaurant portal.
- No additional route changes were made to guest or app areas; only public pages were regrouped.
