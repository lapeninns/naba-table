# Canonical Guest-Facing Routes

This document defines the canonical guest-facing routes within the application, following the routing and canonicalization sprint. Legacy routes are permanently redirected (301) to these canonical paths.

## 1. Public & Marketing Routes

These routes are generally accessible to all users and cover informational and general interaction pages.

- `/thank-you` (General Thank You/Confirmation Page)
- `/item/[slug]` (Restaurant-specific booking entry that renders the booking flow for a given slug)

## 2. Discovery & Booking Flows

These routes facilitate restaurant discovery and the booking process. Entry for guests is expected via a restaurant CTA: `/restaurants/:slug/book`.

- `/restaurants/[slug]` (Specific Restaurant Profile Page)
  - `/restaurants/[slug]/book` (Direct booking interface for a specific restaurant)
- `/bookings/[bookingId]` (View details for a specific booking)
- `/bookings/[bookingId]/thank-you` (Booking Confirmation Page)

## 3. Guest Portal (Authenticated Access)

These routes are typically accessed by logged-in guests and provide personalized experiences and account management. Access to these routes generally requires authentication.

- `/guest` (Guest Dashboard/Home)
- `/guest/bookings` (List of the logged-in user's bookings)
- `/guest/profile` (Manage logged-in user's profile)

## 4. Authentication

- `/auth/signin` (Centralized sign-in page)

## Redirected Legacy Routes (301 Permanent Redirects)

The following routes are permanently redirected to their canonical counterparts:

- `/signin` → `/auth/signin`
- `/guest/signin` → `/auth/signin`
- `/guest/restaurants` → `/restaurants`
- `/guest/browse` → `/restaurants`
- `/browse` → `/restaurants`
- `/guest/item/[slug]` → `/item/[slug]`
- `/reserve` → `/bookings`
- `/booking` → `/bookings`
- `/reserve/[reservationId]` → `/bookings/[bookingId]`
- `/reserve/r/[slug]` → `/restaurants/[slug]/book`
- `/guest/bookings/new` → (Deleted, generic wizard removed)
- `/guest/bookings/[bookingId]` → `/bookings/[bookingId]`
- `/guest/bookings/[bookingId]/thank-you` → `/bookings/[bookingId]/thank-you`
- `/guest/reserve` → `/bookings`
- `/guest/reserve/[reservationId]` → `/bookings/[bookingId]`
- `/guest/reserve/r/[slug]` → `/restaurants/[slug]/book`
- `/guest/restaurant` → `/restaurants`
- `/guest/thank-you` → `/thank-you`
- `/account` → `/guest`
- `/my-bookings` → `/guest/bookings`
