# Guest Route Fixes - Research

## Requirements

### Functional

- Consolidate thank-you/receipt paths to one canonical URL
- Ensure access guards are consistent across guest namespace
- Legacy URLs should redirect, not 404

### Non-Functional

- A11y: All new/modified pages must maintain keyboard navigation, screen reader support
- SEO: Redirects should be 308 (permanent) to preserve link equity
- Performance: Receipt page should prefetch booking data server-side

## Existing Patterns Found

1. **BookingDetailPage** (`booking-page.tsx`) - Shared component for booking details with token support
2. **GuestServerServices** - DI pattern for auth/bookings/profile ports
3. **GuestStatus** component - Unified status/alert UI
4. **useReservation** hook - Client-side booking data fetching

## Constraints

- Cannot break existing email links with tokens
- Must preserve backward compatibility for `/bookings/[id]` URLs
- Auth-or-token pattern must remain consistent

## Risks

- Token expiration could lock users out of receipts → Mitigated by sign-in prompt
- Email templates may link to old URLs → Need to verify/update templates

## Recommended Direction

1. Create smart receipt at `/guest/bookings/[id]/receipt` with actual booking data
2. Convert legacy thank-you pages to redirects
3. Keep restaurant confirmation page as-is (it's the immediate post-booking feedback)
