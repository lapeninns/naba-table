# Guest Route Fixes - Implementation Checklist

## Setup

- [x] Create task directory

## Core Fixes

### 1. Canonical Smart Receipt

- [x] Create `src/app/guest/bookings/[bookingId]/receipt/page.tsx`
  - [x] Server component with prefetch
  - [x] Auth-or-token guard
  - [x] Metadata generation
- [x] Create `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
  - [x] Booking details display
  - [x] Status badge
  - [x] Add to Calendar button
  - [x] Download PDF button
  - [x] Share button
  - [x] Sign-in prompt for token-only access

### 2. Legacy Redirects

- [x] `/bookings/[bookingId]/thank-you` → `/guest/bookings/[bookingId]/receipt`
- [x] `/restaurants/[slug]/thank-you` → `/restaurants/[slug]/book/thank-you`
- [x] `/guest/thank-you` → `/guest/dashboard`

### 3. Verification

- [x] Build passes (`npm run build`)
- [x] All 55 pages compile

## Notes

- GuestSignInForm exists in `components/auth/` (not `src/components/auth/`) - no fix needed
- Auth-or-token pattern reused from `booking-page.tsx`
- Calendar integration uses Google Calendar URL format
