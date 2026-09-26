# Current Application Routes

## Overview

This document lists all active routes in the application after the legacy cleanup (November 2024).

## Route Structure

### Guest-Facing Routes (nabatable.com)

#### Public Routes (No Authentication Required)

| Route                                | Description                                             | File Path                                                        |
| ------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                                  | Landing page                                            | `src/app/page.tsx`                                               |
| `/auth/signin`                       | Guest sign-in page                                      | `src/app/auth/signin/page.tsx`                                   |
| `/restaurants/[slug]/book`           | Restaurant booking wizard                               | `src/app/(marketing)/restaurants/[slug]/book/page.tsx`           |
| `/restaurants/[slug]/book/thank-you` | Booking confirmation page                               | `src/app/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` |
| `/bookings/[bookingId]/thank-you`    | Booking thank-you page                                  | `src/app/bookings/[bookingId]/thank-you/page.tsx`                |
| `/bookings/find`                     | Request a new manage link by email (lost-link recovery) | `src/app/(public)/bookings/find/page.tsx`                        |

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

| Route                     | Description                            | File Path                                       |
| ------------------------- | -------------------------------------- | ----------------------------------------------- |
| `/app/seating`            | Seating overview                       | `src/app/app/(app)/seating/page.tsx`            |
| `/app/seating/capacity`   | Capacity management                    | `src/app/app/(app)/seating/capacity/page.tsx`   |
| `/app/seating/floor-plan` | Floor plan (live service and timeline) | `src/app/app/(app)/seating/floor-plan/page.tsx` |

##### Team Management

| Route                  | Description         | File Path                                    |
| ---------------------- | ------------------- | -------------------------------------------- |
| `/app/management`      | Management overview | `src/app/app/(app)/management/page.tsx`      |
| `/app/management/team` | Team management     | `src/app/app/(app)/management/team/page.tsx` |

##### Settings

| Route                                              | Description                                                                 | File Path                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/app/settings`                                    | Settings overview                                                           | `src/app/app/(app)/settings/page.tsx`                                    |
| `/app/settings/restaurant`                         | Restaurant setup overview (progress and links)                              | `src/app/app/(app)/settings/restaurant/page.tsx`                         |
| `/app/settings/restaurant/profile`                 | Restaurant profile: public details and booking page link                    | `src/app/app/(app)/settings/restaurant/profile/page.tsx`                 |
| `/app/settings/restaurant/availability`            | Availability and booking types, including table times                       | `src/app/app/(app)/settings/restaurant/availability/page.tsx`            |
| `/app/settings/restaurant/operating-hours`         | Former route; renders Availability at Weekly hours                          | `src/app/app/(app)/settings/restaurant/operating-hours/page.tsx`         |
| `/app/settings/restaurant/service-periods`         | Former route; renders Availability at Weekly hours                          | `src/app/app/(app)/settings/restaurant/service-periods/page.tsx`         |
| `/app/settings/restaurant/occasions`               | Former route; renders Availability at Booking types                         | `src/app/app/(app)/settings/restaurant/occasions/page.tsx`               |
| `/app/settings/restaurant/turn-durations`          | Former route; renders Availability at Booking types                         | `src/app/app/(app)/settings/restaurant/turn-durations/page.tsx`          |
| `/app/settings/restaurant/tables`                  | Tables and zones                                                            | `src/app/app/(app)/settings/restaurant/tables/page.tsx`                  |
| `/app/settings/restaurant/discovery`               | Discovery details (categories, links, amenities, services, where you serve) | `src/app/app/(app)/settings/restaurant/discovery/page.tsx`               |
| `/app/settings/restaurant/menu`                    | Menu                                                                        | `src/app/app/(app)/settings/restaurant/menu/page.tsx`                    |
| `/app/settings/restaurant/team`                    | Team invitations                                                            | `src/app/app/(app)/settings/restaurant/team/page.tsx`                    |
| `/app/settings/restaurant/staff-communications`    | Staff communications: manager alerts and daily booking summary              | `src/app/app/(app)/settings/restaurant/staff-communications/page.tsx`    |
| `/app/settings/restaurant/google-business-profile` | Google Business Profile link, compare and publish                           | `src/app/app/(app)/settings/restaurant/google-business-profile/page.tsx` |
| `/app/settings/restaurant/table-layout`            | Floor layout: arrange where tables sit on the floor plan (admin only)       | `src/app/app/(app)/settings/restaurant/table-layout/page.tsx`            |
| `/app/settings/restaurant/email-templates`         | Email templates: write, test and A/B test guest emails (admin only)         | `src/app/app/(app)/settings/restaurant/email-templates/page.tsx`         |
| `/app/email-templates`                             | Redirects to `/app/settings/restaurant/email-templates`                     | `src/app/app/(app)/email-templates/page.tsx`                             |
| `/app/settings/tables`                             | Table configuration                                                         | `src/app/app/(app)/settings/tables/page.tsx`                             |

---

## API Routes

### Guest-Facing APIs

#### Public APIs

| Route                                   | Description                                                             |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `/api/bookings`                         | Booking creation and listing                                            |
| `/api/bookings/[id]`                    | Booking details                                                         |
| `/api/bookings/lookup-email`            | `POST`: email a manage link for upcoming bookings; always a neutral 202 |
| `/api/bookings/confirm`                 | Retired: 410 `CONFIRMATION_ENDPOINT_RETIRED` for GET and POST           |
| `/api/availability`                     | Check restaurant availability                                           |
| `/api/restaurants/[slug]/schedule`      | Public restaurant schedule                                              |
| `/api/restaurants/[slug]/calendar-mask` | Public calendar availability                                            |

#### Protected APIs (Guest)

| Route                | Description                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/api/profile`       | User profile management                                                                                              |
| `/api/profile/image` | Profile image upload. No app caller since the avatar hook was removed; deletion candidate pending a product decision |

### Restaurant-Facing APIs (Ops)

All ops APIs require restaurant staff authentication.

| Route                                            | Description                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `/api/ops/restaurants`                           | Restaurant listing for current user                       |
| `/api/ops/restaurants/[id]`                      | Restaurant details                                        |
| `/api/ops/restaurants/[id]/details`              | Update restaurant details                                 |
| `/api/ops/restaurants/[id]/hours`                | Operating hours management                                |
| `/api/ops/restaurants/[id]/logo`                 | Logo upload (`POST`) and removal (`DELETE`)               |
| `/api/ops/restaurants/[id]/service-periods`      | Service periods                                           |
| `/api/ops/restaurants/[id]/availability`         | Availability snapshot: `GET` and `PUT` in one transaction |
| `/api/ops/restaurants/[id]/menus/**/order`       | Menu section, item and option reordering                  |
| `/api/ops/restaurants/[id]/email-templates/**`   | Email templates, preview and test send                    |
| `/api/ops/occasions`, `/api/ops/occasions/[key]` | Booking type catalog (platform admin writes)              |
| `/api/ops/bookings`                              | Bookings management                                       |
| `/api/ops/bookings/[id]`                         | Booking operations                                        |
| `/api/ops/bookings/[id]/check-in`                | Check-in booking                                          |
| `/api/ops/bookings/[id]/check-out`               | Check-out booking                                         |
| `/api/ops/bookings/[id]/no-show`                 | Mark as no-show                                           |
| `/api/ops/bookings/[id]/undo-no-show`            | Undo a no-show and restore its tables                     |
| `/api/ops/bookings/[id]/move-tables`             | Atomic table move                                         |
| `/api/ops/email-delivery/retry`                  | Resend a failed or bounced email                          |
| `/api/ops/email-queue/[jobId]/cancel`            | Cancel a queued email job                                 |
| `/api/ops/customers`                             | Customer management                                       |
| `/api/ops/dashboard/*`                           | Dashboard data                                            |
| `/api/ops/tables`                                | Table management                                          |
| `/api/ops/tables/holds/[holdId]`                 | `DELETE`: release a table hold                            |
| `/api/ops/zones`                                 | Zone management                                           |
| `/api/ops/team/*`                                | Team management                                           |
| `/api/ops/team/invitations/[id]/resend`          | Resend a pending invitation                               |

### Onboarding APIs

| Route                                                 | Description                                             |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `/api/onboarding/restaurant`                          | Create the restaurant                                   |
| `/api/onboarding/restaurant/[id]/profile`             | `PATCH` changed profile fields                          |
| `/api/onboarding/restaurant/[id]/hours`               | Operating hours                                         |
| `/api/onboarding/restaurant/[id]/service-periods`     | Service periods                                         |
| `/api/onboarding/restaurant/[id]/layout`              | `PUT` zones and tables in one replace                   |
| `/api/onboarding/restaurant/[id]/zones`, `.../tables` | Kept for compatibility; the wizard no longer calls them |
| `/api/onboarding/restaurant/[id]/complete`            | Readiness check before opening the dashboard            |

### Authentication APIs

| Route                | Description    |
| -------------------- | -------------- |
| `/api/auth/signin`   | Sign in        |
| `/api/auth/callback` | OAuth callback |

---

## Mutation API contracts (September 2026)

Every route below returns C1 error bodies (`lib/api/errors.ts`): `{ error, code, message, fields?, retryable?, retryAfter?, details? }`. `error` repeats `message` for older readers. Messages are safe to show and never contain raw database or provider text. Every mutation is CSRF-protected (`withCsrfProtectedMutation`) unless the row says otherwise. A 429 is `RATE_LIMITED` with a `Retry-After` header and `retryable: true`.

### Guest booking access

| Route                        | Method        | Access                           | Contract                                                                                                                                                                                 |
| ---------------------------- | ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bookings/find`             | page          | Public                           | Asks for an email address and a venue, then calls `POST /api/bookings/lookup-email`.                                                                                                     |
| `/api/bookings/lookup-email` | `POST`        | Public, CSRF token, rate limited | Emails a manage link for the requester's upcoming bookings at one venue, to the address stored on each booking. Always answers a neutral 202, whether or not bookings exist.             |
| `/api/bookings`              | `GET`         | Guest session                    | Only the signed-in guest's own bookings (`me`). Every other query, including the former contact lookup, returns 410 `CONTACT_LOOKUP_REMOVED`.                                            |
| `/api/bookings`              | `POST`        | Public                           | Booking create. Idempotent at the database level: a replayed `Idempotency-Key` returns the original booking; the same key with a different payload returns 409 `IDEMPOTENCY_KEY_REUSED`. |
| `/api/bookings/confirm`      | `GET`, `POST` | Retired                          | Always 410 `CONFIRMATION_ENDPOINT_RETIRED`. Reads no token, returns no booking data and clears the retired `sr_confirm` and `sr_access` cookies.                                         |

### Ops bookings and tables

| Route                                                       | Method   | Access                                    | Contract                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | -------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ops/bookings/[id]/move-tables`                        | `POST`   | Ops, booking-scoped restaurant membership | Body `{ restaurantId?, fromTableIds, toTableIds, idempotencyKey, contextVersion? }`. Moves the booking's tables in one transaction; `fromTableIds` is a compare-and-set guard. The 200 body matches assign-tables (`assignments` and `summary` cover the full resulting set). `contextVersion` is validated but not enforced. |
| `/api/ops/bookings/[id]/check-in`, `/check-out`, `/no-show` | `POST`   | Ops                                       | A lifecycle transition that no longer applies returns 409 `BOOKING_STATE_CONFLICT` with `details.currentStatus`. Success bodies also carry `booking`, `assignments`, `tablesRestored` and `tableRestoration`.                                                                                                                 |
| `/api/ops/bookings/[id]/undo-no-show`                       | `POST`   | Ops                                       | Restores the tables released by the no-show when they are still free (`tablesRestored`). Missing history stays 400.                                                                                                                                                                                                           |
| `/api/ops/bookings/[id]`                                    | `DELETE` | Ops                                       | Cancelling a booking that can no longer be cancelled returns 409 `BOOKING_NOT_CANCELLABLE`. Not yet wrapped in `withCsrfProtectedMutation` (known gap, like its `PATCH`).                                                                                                                                                     |
| `/api/ops/tables/holds/[holdId]?restaurantId=<uuid>`        | `DELETE` | Ops, any restaurant member                | Releases a table hold. Returns `{ data: { holdId, released: true, alreadyReleased } }`. Errors: 400 `INVALID_RESTAURANT_ID`, 403 `FORBIDDEN`, 404 `HOLD_NOT_FOUND`, 500 `INTERNAL_ERROR`.                                                                                                                                     |

### Restaurant settings

| Route                                                                                        | Method   | Access            | Contract                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ops/restaurants/[id]/availability`                                                     | `GET`    | Restaurant member | Returns `{ data: AvailabilitySnapshot }`, where the snapshot is `{ restaurantId, revision, hours, servicePeriods, turnBands, rules }`.                                                               |
| `/api/ops/restaurants/[id]/availability`                                                     | `PUT`    | Restaurant admin  | Body `{ hours?, servicePeriods?, turnBands?, rules?, expectedRevision? }`, saved in one transaction. Returns `{ data: AvailabilitySnapshot }`. A stale `expectedRevision` returns 409 `STALE_WRITE`. |
| `/api/ops/occasions/[key]`                                                                   | `DELETE` | Platform admin    | Atomic. 404 `OCCASION_NOT_FOUND`, 400 `OCCASION_BUILTIN`, 409 `OCCASION_IN_USE` with usage counts.                                                                                                   |
| `/api/ops/restaurants/[id]`                                                                  | `PATCH`  | Owner or manager  | Profile saves go through one RPC. 400 `VALIDATION_FAILED` with `fields`, 409 `SLUG_TAKEN`.                                                                                                           |
| `/api/ops/restaurants/[id]/logo`                                                             | `POST`   | Owner or manager  | Uploads a versioned logo, saves `logo_url` and returns `{ path, url, cacheKey, restaurant }`.                                                                                                        |
| `/api/ops/restaurants/[id]/logo`                                                             | `DELETE` | Owner or manager  | Clears `logo_url` and deletes the replaced stored object.                                                                                                                                            |
| `/api/ops/restaurants/[id]/business-context`                                                 | `PUT`    | Restaurant admin  | Atomic save with a revision precondition; a concurrent edit returns 409 `STALE_WRITE`.                                                                                                               |
| `/api/ops/restaurants/[id]/menus/[menuId]/sections/order`                                    | `PATCH`  | Restaurant admin  | Body `{ orderedIds: uuid[] }` (the complete set). Returns `{ data: { order: [{ id, displayOrder }] } }`. A changed set returns 409 `MENU_ORDER_STALE`.                                               |
| `/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/order`                  | `PATCH`  | Restaurant admin  | As sections/order, for the items in one section.                                                                                                                                                     |
| `/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/[itemId]/options/order` | `PATCH`  | Restaurant admin  | As sections/order, for the options on one item.                                                                                                                                                      |
| `/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items`                        | `POST`   | Restaurant admin  | Accepts `idempotencyKey` and `options[]`; a replay returns 200 with the originally created item.                                                                                                     |
| `/api/ops/restaurants/[id]/menus/[menuId]/sections/[sectionId]/items/[itemId]`               | `PATCH`  | Restaurant admin  | Accepts `attributesMerge` and `extensionsMerge`, so concurrent edits to different keys both survive.                                                                                                 |

### Communications

| Route                                                               | Method | Access            | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ops/email-delivery/retry`                                     | `POST` | Ops, rate limited | Resends a failed or bounced email. Returns the retry `status` and `retryAttempt`. 409 codes: `NOT_RETRYABLE`, `MISSING_BOOKING`, `MISSING_RECIPIENT`, `RETRY_IN_PROGRESS`, `ALREADY_RETRIED`. 404 `NOT_FOUND`. 502 `SEND_FAILED` when the provider refused the send, and 502 `SEND_UNCONFIRMED` when the outcome is unknown; an unconfirmed retry reuses its provider idempotency key and never sends twice within the provider's window. |
| `/api/ops/email-queue/[jobId]/cancel`                               | `POST` | Ops, rate limited | 409 `JOB_IN_PROGRESS` while a worker holds the job, 409 `JOB_NOT_CANCELLABLE` once it is final.                                                                                                                                                                                                                                                                                                                                           |
| `/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send` | `POST` | Restaurant admin  | Optional `Idempotency-Key` header (tenant-scoped). 409 `RECIPIENT_SUPPRESSED`, 502 `SEND_FAILED`.                                                                                                                                                                                                                                                                                                                                         |
| `/api/ops/restaurants/[id]/email-templates/**`                      | all    | Restaurant admin  | 503 `MEMBERSHIP_UNAVAILABLE` when membership cannot be checked.                                                                                                                                                                                                                                                                                                                                                                           |

### Team

| Route                                   | Method | Access                         | Contract                                                                                                                                                                                                        |
| --------------------------------------- | ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ops/team/invitations/[id]/resend` | `POST` | Owner or manager, rate limited | Rotates the invitation token and emails a new link; the previous link stops working. Keeps the original expiry. 404 `INVITE_NOT_FOUND`, 409 `INVITE_EXPIRED` or `INVITE_NOT_PENDING`, 502 when the email fails. |

### Onboarding

| Route                                                       | Method  | Access                          | Contract                                                                                                                                                                                |
| ----------------------------------------------------------- | ------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/onboarding/restaurant/[id]/layout`                    | `PUT`   | Restaurant admin, 20 per minute | Replaces zones and tables in one transaction. Zones and tables missing from the payload are deleted only when they have no bookings or holds; otherwise 409 `ONBOARDING_LAYOUT_LOCKED`. |
| `/api/onboarding/restaurant/[id]/profile`                   | `PATCH` | Restaurant admin, 10 per minute | Changed fields only. 409 `SLUG_TAKEN`.                                                                                                                                                  |
| `/api/onboarding/restaurant/[id]/complete`                  | `POST`  | Restaurant admin                | Readiness check only; 409 `ONBOARDING_INCOMPLETE` lists what is missing.                                                                                                                |
| `/api/onboarding/restaurant/[id]/hours`, `/service-periods` | `PUT`   | Restaurant admin                | Schedule rule violations return 400 `VALIDATION_FAILED` with field paths.                                                                                                               |

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
- Everything under `/app/settings/restaurant/*` is for owners and managers only (the settings layout redirects other roles to `/app/bookings`). This includes Email templates and Floor layout: since September 2026, staff without an admin role no longer see a read-only copy of the email templates, and the live floor plan no longer offers Arrange mode.
