---
task: luminous-booking-journey-redesign
timestamp_utc: 2026-04-11T17:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@guest-experience]
risk: medium
flags: []
related_tickets: []
---

# Research: Luminous Booking Journey Redesign

## Requirements

- Functional:
  - Save the provided design system as a root-level guest-facing source-of-truth document.
  - Redesign the guest booking journey from scratch using only the provided design system blueprint.
  - Apply the redesign to the canonical booking path, not a temporary guest-only wrapper.
  - Cover the journey across booking entry, step flow, confirmation, booking management, receipt, and guest list/detail surfaces.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve keyboard navigation and visible focus for every step and post-booking screen.
  - Maintain URL stability for public booking and guest booking management routes.
  - Keep auth and recovery boundaries intact; visual redesign must not weaken guest/session access checks.
  - Prefer tokenized surfaces and shared components over one-off styling.
  - Avoid regressions to booking creation, review, and receipt flows.

## Existing Patterns & Reuse

- Canonical booking wizard lives in `reserve/features/reservations/wizard/**` and is consumed by `src/components/features/booking/wizard/ReservationWizardClient.tsx`.
- Canonical public booking entry route lives at `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`.
- Canonical public booking detail route lives at `src/app/(public)/bookings/[bookingId]/page.tsx`.
- Guest booking list/detail/receipt surfaces reuse production paths under:
  - `src/components/features/booking/list/BookingListClient.tsx`
  - `src/components/features/booking/detail/ReservationDetailClient.tsx`
  - `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
- Existing guest visual layer is split across:
  - `src/app/globals.css`
  - `styles/guest-design-system.css`
  - legacy guest primitives in `src/components/guest/ui/GuestPrimitives.tsx`

## External Resources

- User-provided “The Luminous Precision Framework” — authoritative visual blueprint for guest-facing pages in this task.

## Constraints & Risks

- Root and nested `AGENTS.md` require SDLC ordering, task artifacts, Shadcn-first UI, and Chrome DevTools verification for UI changes.
- The provided design system conflicts with parts of the current guest theme:
  - current guest components rely on hard borders/dividers
  - current guest shells use default shadows instead of tonal layering
  - current hero/navigation styling does not follow the no-line or glass-and-gradient rules
- The booking wizard is shared via `reserve/**`; redesigning only the Next.js wrapper would leave the real flow visually inconsistent.
- The scope is large; the safest canonical cut is to redesign shared booking shells/components first, then apply them to the main booking journey surfaces in this task.

## Open Questions (owner, due)

- Q: Should the design system supersede previous guest style migration notes?
  A: Yes for this task. The attached design system is the new guest-facing source of truth. Owner: agent. Due: immediate.

## Recommended Direction (with rationale)

- Create a root document for the design system so the blueprint is durable and referenceable.
- Amend guest-facing local guidance to explicitly defer visual decisions to that root design system document.
- Introduce shared guest-booking tokens/utilities that encode:
  - tonal surface hierarchy
  - glass surfaces
  - gradient CTA treatment
  - Manrope/Inter hierarchy
  - no-line separation rules
- Refactor the canonical booking wizard shell and shared booking summary panels first, then re-skin the booking entry, list, detail, receipt, and thank-you surfaces with those same primitives.
- Keep business logic, data fetching, and auth flows intact; this is a design-system-led UI rebuild, not a domain rewrite.
