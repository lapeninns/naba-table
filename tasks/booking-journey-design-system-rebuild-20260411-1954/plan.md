---
task: booking-journey-design-system-rebuild
timestamp_utc: 2026-04-11T19:54:58Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Journey Design-System Rebuild

## Objective

We will rebuild the guest booking journey around the Luminous Precision design system so guests experience one calm, premium flow from discovery entry through booking, confirmation, detail, recovery, and receipt.

## Success Criteria

- [ ] `/bookings` reads as a design-system-native entry point instead of a generic card landing page.
- [ ] `/restaurants/[slug]/book` feels cohesive across hero, step layout, progress, forms, and confirmation states.
- [ ] `/restaurants/[slug]/book/thank-you`, `/bookings/[bookingId]`, `/bookings/recover/error`, and the receipt target reached via redirects share the same visual language and interaction treatment.
- [ ] Redirect routes preserve current behavior with no access-model regression.
- [ ] Shared booking UI components are the single source of truth for detail/receipt surfaces.
- [ ] Browser verification proves the target routes match the design system and remain accessible.

## Architecture & Components

- Scope guard:
  - Only guest-facing booking routes and shared guest-booking components may be changed as part of the preset-informed redesign.
  - Ops/admin/auth/non-guest surfaces must remain untouched.
- `src/app/(public)/bookings/page.tsx`
  - Recompose as a public booking entry page with a stronger hero, clearer action split, and design-system-native sections.
- `reserve/features/reservations/wizard/ui/**`
  - Refresh wizard layout, step presentation, and action chrome while preserving existing wizard state/hooks.
- `src/components/features/booking/ui/BookingComponents.tsx`
  - Centralize redesigned shared shells, status blocks, metadata rows, action groups, and aside patterns.
- `src/components/features/booking/detail/ReservationDetailClient.tsx`
  - Recompose around the shared shell to improve hierarchy and tone without changing behavior.
- `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
  - Align the receipt target with the same shared component language used by the public thank-you/detail flow.
- `src/components/restaurants/PublicSections.tsx`
  - Replace the old thank-you card with a booking-journey-native confirmation section or shared component.
- `src/app/(public)/bookings/recover/error/page.tsx`
  - Rebuild as a more intentional recovery-state experience using the same tonal architecture.

## Preset Translation Strategy

- Inspect `b1aKNEah8` as a design/foundation reference, not as an in-place installer.
- Translate only guest-safe aspects into the current repo:
  - rounded scale and soft control geometry
  - calmer shared action treatment
  - translucent menu/chrome cues where already guest-scoped
  - spacing and typography rhythm compatible with `/GUEST_FACING_DESIGN_SYSTEM.md`
- Preserve current repo structure:
  - keep `radix` base
  - keep existing alias layout
  - keep guest changes inside existing guest/public booking codepaths

## Data Flow & API Contracts

- No API contract changes planned.
- Existing route/auth behavior remains unchanged:
  - `/bookings/[bookingId]` still requires auth or recovery cookie.
  - Receipt still loads via the existing reservation detail query path.
  - Recovery error remains query-param driven.
  - Thank-you/manage redirect routes remain pure redirects.

## UI/UX States

- Public entry:
  - Orient new guests to start booking or manage existing plans.
- Booking wizard:
  - Hero orientation, progress, form surfaces, review, and confirmation all use tonal layering rather than boxed card stacks.
- Detail / receipt:
  - Status-first summary, reservation facts, guest details, next actions, and support guidance.
- Recovery error:
  - Calm failure framing with a clear next best action instead of a plain alert block.

## Edge Cases

- Missing or invalid booking IDs still redirect/fail exactly as today.
- Recovery error copy must stay mapped by backend error code.
- Thank-you route should work whether guests arrive directly after booking or from a link refresh.
- Reduced-motion users should not lose access to hierarchy or action clarity.

## Testing Strategy

- Targeted automated checks:
  - `pnpm typecheck`
  - focused lint/format or targeted tests if needed for edited components
- Manual browser verification via Chrome DevTools MCP:
  - `/bookings`
  - `/restaurants/[slug]/book` or a valid dev harness if direct flow setup is required
  - `/restaurants/[slug]/book/thank-you`
  - `/bookings/[bookingId]` or the best available proof surface for the authenticated/recovery path
  - `/bookings/recover/error`
  - receipt target if needed to prove preserved redirect coherence

## Rollout

- No feature flag planned; this is a canonical guest-surface redesign with unchanged route contracts.
- Rollout boundary: guest-facing booking pages only.
- Monitor for:
  - hydration issues on guest routes
  - wizard step regressions
  - broken redirect paths
  - a11y regressions from layout changes

## DB Change Plan (if applicable)

- No database changes planned.
