# Architecture

Architectural decisions, guest-route ownership notes, and shared implementation patterns for this mission.

---

## Guest Surface Groups

- **Marketing / discovery**
  - `src/app/(public)/page.tsx`
  - `src/app/(public)/(marketing)/restaurants/**`
- **Guest auth**
  - `src/app/(public)/auth/**`
- **Public booking lifecycle**
  - `src/app/(public)/bookings/**`
  - `src/app/(public)/(marketing)/restaurants/[slug]/book/**`
- **Guest portal**
  - `src/app/guest/**`

## Shared Shell Ownership

- `src/components/layouts/MarketingLayout.tsx` governs public marketing/discovery surfaces.
- `src/components/layouts/GuestLayout.tsx` governs `/guest/**` and public booking routes.
- `src/components/layouts/EnhancedAuthLayout.tsx` and `RoleSelectionLayout.tsx` are guest-facing auth entry shells that should converge toward the same guest system.
- `src/components/layouts/GuestNavbar.tsx` is the primary guest navigation primitive.

## Shared Guest Primitives

- `src/components/guest/ui/GuestPrimitives.tsx` is the canonical guest primitive layer for:
  - sections
  - cards
  - empty states
  - status messaging
  - guest-oriented action affordances

When a guest-facing page needs a new pattern, extend the canonical guest primitives first instead of creating a separate page-local pattern.

## Route Ownership Pattern

- Guest/public/auth route ownership is enforced through:
  - App Router route files in `src/app/**`
  - guest auth helpers under `src/guest/services/**`
  - redirect helpers under `lib/auth/**` and `lib/url/**`
  - host/path canonicalization in `src/proxy.ts`

Route canonicalization should stay centralized. Do not duplicate redirect logic across unrelated page components.

## Booking Lifecycle Reuse

- Public and guest booking detail flows reuse `src/app/(public)/bookings/booking-page.tsx` and `src/components/features/booking/detail/ReservationDetailClient.tsx`.
- Receipt flows live under `src/app/guest/bookings/[bookingId]/receipt/**`.
- Recovery flow and token normalization live under `src/app/(public)/bookings/recover/**`.

When adjusting booking lifecycle UX, keep public detail, guest detail, recovery, and receipt behavior aligned.

## Portal Data Coherence

- Guest dashboard, guest bookings, and guest profile consume the guest route/view-model layer under `src/guest/routes/**` and hooks under `src/guest/hooks/**`.
- Mocked portal validation is accepted for this mission, so fixture coherence across dashboard/bookings/profile matters.

## Canonical Migration Rule

Do not “polish” individual guest pages in isolation if they still depend on competing shell/layout primitives. First move them onto the canonical guest shell/primitives, then refine the page-level experience.
