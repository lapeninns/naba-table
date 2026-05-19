# Current Application Routes

## Overview

This document lists all active routes in the application after the legacy cleanup (November 2024).

## Route Structure

### Guest-Facing Routes (nabatable.com)

#### Public Routes (No Authentication Required)

| Route                                | Description               | File Path                                                        |
| ------------------------------------ | ------------------------- | ---------------------------------------------------------------- |
| `/`                                  | Landing page              | `src/app/page.tsx`                                               |
| `/auth/signin`                       | Guest sign-in page        | `src/app/auth/signin/page.tsx`                                   |
| `/restaurants/[slug]/book`           | Restaurant booking wizard | `src/app/(marketing)/restaurants/[slug]/book/page.tsx`           |
| `/restaurants/[slug]/book/thank-you` | Booking confirmation page | `src/app/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` |
| `/bookings/[bookingId]/thank-you`    | Booking thank-you page    | `src/app/bookings/[bookingId]/thank-you/page.tsx`                |

#### Protected Routes (Require Guest Authentication)

| Route                         | Description               | File Path                                     | Redirect When Unauthenticated                             |
| ----------------------------- | ------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `/guest/dashboard`            | Guest dashboard           | `src/app/guest/dashboard/page.tsx`            | `/auth/signin?redirectedFrom=/guest/dashboard`            |
| `/guest/profile`              | Guest profile management  | `src/app/guest/profile/page.tsx`              | `/auth/signin?redirectedFrom=/guest/profile`              |
| `/guest/bookings`             | Guest bookings list       | `src/app/guest/bookings/page.tsx`             | `/auth/signin?redirectedFrom=/guest/bookings`             |
| `/guest/bookings/[bookingId]` | Individual booking detail | `src/app/guest/bookings/[bookingId]/page.tsx` | `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]` |

#### Partially Protected Routes

| Route                   | Description         | File Path                               | Access Requirements                         |
| ----------------------- | ------------------- | --------------------------------------- | ------------------------------------------- |
| `/bookings/[bookingId]` | Booking detail page | `src/app/bookings/[bookingId]/page.tsx` | Authenticated user OR valid token parameter |

---

### Restaurant-Facing Routes (app.nabatable.com)

All restaurant routes are accessed via the `app.nabatable.com` subdomain or `nabatable.com/app/*` (which redirects to subdomain).

#### Public Routes

| Route              | Description              | File Path                          |
| ------------------ | ------------------------ | ---------------------------------- |
| `/app/auth/signin` | Restaurant staff sign-in | `src/app/app/auth/signin/page.tsx` |

#### Protected Routes (Require Restaurant Staff Authentication)

All routes under `/app/(app)/*` require authentication. Unauthenticated users are redirected to `/app/auth/signin`.

##### Dashboard & Overview

| Route            | Description                             | File Path                              |
| ---------------- | --------------------------------------- | -------------------------------------- |
| `/app`           | Main dashboard (same as /app/dashboard) | `src/app/app/(app)/page.tsx`           |
| `/app/dashboard` | Dashboard overview                      | `src/app/app/(app)/dashboard/page.tsx` |

##### Bookings & Walk-ins

| Route           | Description                 | File Path                             |
| --------------- | --------------------------- | ------------------------------------- |
| `/app/bookings` | Bookings management         | `src/app/app/(app)/bookings/page.tsx` |
| `/app/walk-in`  | Walk-in customer management | `src/app/app/(app)/walk-in/page.tsx`  |

##### Customer Management

| Route            | Description       | File Path                              |
| ---------------- | ----------------- | -------------------------------------- |
| `/app/customers` | Customer database | `src/app/app/(app)/customers/page.tsx` |

##### Analytics

| Route                       | Description         | File Path                                         |
| --------------------------- | ------------------- | ------------------------------------------------- |
| `/app/analytics`            | Analytics overview  | `src/app/app/(app)/analytics/page.tsx`            |
| `/app/analytics/rejections` | Rejection analytics | `src/app/app/(app)/analytics/rejections/page.tsx` |

##### Seating Management

| Route                     | Description         | File Path                                       |
| ------------------------- | ------------------- | ----------------------------------------------- |
| `/app/seating`            | Seating overview    | `src/app/app/(app)/seating/page.tsx`            |
| `/app/seating/capacity`   | Capacity management | `src/app/app/(app)/seating/capacity/page.tsx`   |
| `/app/seating/floor-plan` | Floor plan editor   | `src/app/app/(app)/seating/floor-plan/page.tsx` |

##### Team Management

| Route                  | Description         | File Path                                    |
| ---------------------- | ------------------- | -------------------------------------------- |
| `/app/management`      | Management overview | `src/app/app/(app)/management/page.tsx`      |
| `/app/management/team` | Team management     | `src/app/app/(app)/management/team/page.tsx` |

##### Settings

| Route                                      | Description         | File Path                                                        |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------- |
| `/app/settings`                            | Settings overview   | `src/app/app/(app)/settings/page.tsx`                            |
| `/app/settings/restaurant`                 | Redirect to profile | `src/app/app/(app)/settings/restaurant/page.tsx`                 |
| `/app/settings/restaurant/profile`         | Restaurant profile  | `src/app/app/(app)/settings/restaurant/profile/page.tsx`         |
| `/app/settings/restaurant/operating-hours` | Operating hours     | `src/app/app/(app)/settings/restaurant/operating-hours/page.tsx` |
| `/app/settings/restaurant/service-periods` | Service periods     | `src/app/app/(app)/settings/restaurant/service-periods/page.tsx` |
| `/app/settings/restaurant/occasions`       | Special occasions   | `src/app/app/(app)/settings/restaurant/occasions/page.tsx`       |
| `/app/settings/restaurant/team`            | Team settings       | `src/app/app/(app)/settings/restaurant/team/page.tsx`            |
| `/app/settings/tables`                     | Table configuration | `src/app/app/(app)/settings/tables/page.tsx`                     |

---

## API Routes

### Guest-Facing APIs

#### Public APIs

| Route                                   | Description                   |
| --------------------------------------- | ----------------------------- |
| `/api/bookings`                         | Booking creation and listing  |
| `/api/bookings/[id]`                    | Booking details               |
| `/api/availability`                     | Check restaurant availability |
| `/api/restaurants/[slug]/schedule`      | Public restaurant schedule    |
| `/api/restaurants/[slug]/calendar-mask` | Public calendar availability  |

#### Protected APIs (Guest)

| Route                | Description             |
| -------------------- | ----------------------- |
| `/api/profile`       | User profile management |
| `/api/profile/image` | Profile image upload    |

### Restaurant-Facing APIs (Ops)

All ops APIs require restaurant staff authentication.

| Route                                       | Description                         |
| ------------------------------------------- | ----------------------------------- |
| `/api/ops/restaurants`                      | Restaurant listing for current user |
| `/api/ops/restaurants/[id]`                 | Restaurant details                  |
| `/api/ops/restaurants/[id]/details`         | Update restaurant details           |
| `/api/ops/restaurants/[id]/hours`           | Operating hours management          |
| `/api/ops/restaurants/[id]/logo`            | Logo upload                         |
| `/api/ops/restaurants/[id]/service-periods` | Service periods                     |
| `/api/ops/bookings`                         | Bookings management                 |
| `/api/ops/bookings/[id]`                    | Booking operations                  |
| `/api/ops/bookings/[id]/check-in`           | Check-in booking                    |
| `/api/ops/bookings/[id]/check-out`          | Check-out booking                   |
| `/api/ops/bookings/[id]/no-show`            | Mark as no-show                     |
| `/api/ops/customers`                        | Customer management                 |
| `/api/ops/dashboard/*`                      | Dashboard data                      |
| `/api/ops/tables`                           | Table management                    |
| `/api/ops/zones`                            | Zone management                     |
| `/api/ops/team/*`                           | Team management                     |

### Authentication APIs

| Route                | Description    |
| -------------------- | -------------- |
| `/api/auth/signin`   | Sign in        |
| `/api/auth/callback` | OAuth callback |

---

## Proxy (formerly middleware)

The application uses Next.js proxy for:

1. **Subdomain routing**: Redirects `/app/*` on main domain to `app.nabatable.com`
2. **API rewrites**: Rewrites `/api/<service>` to `/api/ops/<service>` on app subdomain
3. **CSRF protection**: Issues CSRF tokens

Preview/local note: when `VERCEL_ENV=preview` or host is listed in `NEXT_PUBLIC_LOCAL_APP_HOSTS`, `/app/*` stays on the same host.

See `src/proxy.ts` for implementation.

---

## Route Groups

The application uses Next.js route groups for organization:

- `(marketing)` - Marketing and public guest pages
- `(app)` - Protected restaurant-facing pages
- `guest` - Guest-facing protected pages
- `auth` - Authentication pages

---

## Notes

- All restaurant routes are accessible via both `nabatable.com/app/*` and `app.nabatable.com/*`
- The `/app/*` path on the main domain redirects to the app subdomain
- Authentication is enforced at the layout level for the `(app)` route group
- Guest authentication is enforced at the page level
