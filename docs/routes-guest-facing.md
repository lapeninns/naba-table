# Canonical Routing Specification (Guest Facing)

**Status:** Approved for Implementation
**Sprint:** 1
**Epic:** 1.1

## Core Architecture Decisions

1.  **Terminology Unification:**
    - **Decision:** Use **"Booking"** exclusively for the entity and action.
    - **Rationale:** Codebase analysis shows "Booking" usage (1600+) vastly outweighs "Reservation" (130+).
    - **Impact:** `/reserve` routes will migrate to `/booking`.

2.  **Auth Centralization:**
    - **Decision:** Single entry point at `/auth/signin`.
    - **Rationale:** Eliminates fragmentation (`/guest/signin`, `/signin`) and simplifies redirect logic.

3.  **Unified Discovery:**
    - **Decision:** Merge "Guest" and "Public" discovery views.
    - **Rationale:** SEO benefits and reduced code duplication. A logged-in user on `/restaurants` sees the same page as a public user, but with personalized enhancements (e.g., "You visited 3 times").

## Canonical Route Map

### 1. Public / Marketing

| Page    | Legacy / Alias  | **Canonical Route** | Status                     |
| :------ | :-------------- | :------------------ | :------------------------- |
| Home    |                 | `/`                 | Public                     |
| Contact |                 | `/contact`          | Public                     |
| Privacy |                 | `/privacy-policy`   | Public                     |
| Terms   |                 | `/terms`            | Public                     |
| Sign In | `/signin`       | `/auth/signin`      | Public (Redirects if auth) |
|         | `/guest/signin` |                     |                            |

### 2. Discovery & Restaurants

| Page               | Legacy / Alias              | **Canonical Route**   | Status |
| :----------------- | :-------------------------- | :-------------------- | :----- |
| Browse/Search      | `/guest/browse`             | `/browse`             | Mixed  |
| Restaurant List    | `/guest/restaurants`        | `/restaurants`        | Mixed  |
| Restaurant Profile | `/guest/restaurant`         | `/restaurants/[slug]` | Mixed  |
|                    | `/guest/restaurants/[slug]` |                       |        |
| Menu Item          | `/guest/item/[slug]`        | `/item/[slug]`        | Mixed  |

### 3. Booking Flow

| Page                 | Legacy / Alias                   | **Canonical Route**              | Status      |
| :------------------- | :------------------------------- | :------------------------------- | :---------- |
| Start Booking        | `/reserve/r/[slug]`              | `/restaurants/[slug]/book`       | Public      |
|                      | `/book/[slug]`                   |                                  |             |
| Booking Confirmation | `/reserve/[id]/thank-you`        | `/booking/[bookingId]/thank-you` | Public/Auth |
|                      | `/guest/bookings/[id]/thank-you` |                                  |             |

### 4. Guest Portal (Logged In)

| Page             | Legacy / Alias         | **Canonical Route**    | Status        |
| :--------------- | :--------------------- | :--------------------- | :------------ |
| Dashboard        | `/account`             | `/guest`               | Auth Required |
|                  | `/guest/dashboard`     |                        |               |
| My Bookings      | `/account/bookings`    | `/guest/bookings`      | Auth Required |
|                  | `/guest/my-bookings`   |                        |               |
| Booking Details  | `/reserve/[id]`        | `/booking/[bookingId]` | Auth/Token    |
|                  | `/guest/bookings/[id]` |                        |               |
| Profile Settings | `/account/profile`     | `/guest/profile`       | Auth Required |

## Redirect Strategy (Sprint 1.2)

Implementation of 301 Redirects in `next.config.js`:

- `/signin` &rarr; `/auth/signin`
- `/guest/signin` &rarr; `/auth/signin`
- `/guest/restaurants` &rarr; `/restaurants`
- `/guest/restaurant` &rarr; `/restaurants` (or specific slug if preserved in query)
- `/account` &rarr; `/guest`
- `/reserve` &rarr; `/booking` (Wait for Story 2.2 to fully implement target routes)
