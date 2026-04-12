---
task: booking-journey-design-system-rebuild
timestamp_utc: 2026-04-11T19:54:58Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Journey Design-System Rebuild

## Requirements

- Functional:
  - Rebuild the guest-facing booking journey using `/GUEST_FACING_DESIGN_SYSTEM.md` as the visual source of truth.
  - Cover the live public routes `/bookings`, `/restaurants/[slug]/book`, `/restaurants/[slug]/book/thank-you`, `/bookings/[bookingId]`, and `/bookings/recover/error`.
  - Preserve redirect behavior for `/restaurants/[slug]/thank-you`, `/bookings/[bookingId]/manage`, and `/bookings/[bookingId]/thank-you`.
  - Keep each route's existing purpose and access model intact:
    - `/bookings`: public orientation / entry surface.
    - `/restaurants/[slug]/book`: live booking wizard for a real restaurant slug.
    - `/restaurants/[slug]/book/thank-you`: post-submit confirmation surface.
    - `/bookings/[bookingId]`: authenticated or recovery-cookie booking detail surface.
    - `/bookings/recover/error`: public recovery failure state.
  - Keep the canonical route wiring thin and move reusable guest UI into shared booking components.
  - Maintain the downstream receipt/guest-management experience where redirect targets land, so the journey remains visually coherent end to end.
- Non-functional:
  - Use Shadcn primitives only; no new bespoke base primitives.
  - Treat the inspected `b1aKNEah8` Shadcn preset as reference material only for guest-facing pages; do not migrate the repo-wide UI foundation, monorepo shape, or non-guest surfaces.
  - Follow the Luminous Precision rules: tonal layering, no divider lines, glassy overlays, Manrope + Inter hierarchy, gradient CTA treatment, mobile-first spacing.
  - Keep accessibility intact: keyboard navigation, focus visibility, semantic structure, descriptive actions, reduced-motion respect.
  - Avoid adding new business logic paths; preserve the current booking/recovery/detail flow contracts.

## Existing Patterns & Reuse

- `styles/guest-design-system.css` already defines the core luminous tokens and utility classes matching the root design document.
- `src/components/layouts/GuestLayout.tsx`, `MarketingLayout.tsx`, and `guest-font.ts` already provide the typography and shell setup for guest routes.
- `reserve/features/reservations/wizard/ui/**` is the canonical booking wizard path and already contains the step/state machinery; the redesign should happen there rather than via route-local clones.
- `src/components/features/booking/ui/BookingComponents.tsx` is the current shared shell for booking detail and receipt surfaces, and is the right place to centralize the redesign.
- `src/components/features/booking/detail/ReservationDetailClient.tsx` and `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx` are the canonical detail/receipt experiences behind the public redirects.
- `src/guest/routes/bookings/page-view.tsx` uses `BookingListClient`, so list-level visual changes should happen in the shared client component if that surface is touched for consistency.

## External Resources

- [`/GUEST_FACING_DESIGN_SYSTEM.md`](../../GUEST_FACING_DESIGN_SYSTEM.md) — authoritative visual direction for the redesigned guest booking journey.
- [`/AGENTS.md`](../../AGENTS.md) — root delivery policy, task artifacts, Shadcn requirement, and mandatory DevTools verification.
- [`src/app/AGENTS.md`](../../src/app/AGENTS.md) — route composition and dev-harness rules.
- [`src/components/AGENTS.md`](../../src/components/AGENTS.md) — shared component structure and Shadcn primitives rules.
- [`src/guest/AGENTS.md`](../../src/guest/AGENTS.md) — guest route expectations and guest-facing visual precedence.

## Constraints & Risks

- The worktree is already dirty in many of the booking-journey files. Changes must be additive/careful and cannot blindly reset or overwrite unrelated edits.
- The inspected preset is a `base` + monorepo Shadcn foundation while this repo is currently `radix` + single-app. Applying it globally would affect non-guest surfaces and is out of scope for this task.
- Some luminous styling already exists but is inconsistent; the risk is accidental partial convergence rather than a deliberate end-to-end system.
- Redirect behavior must remain unchanged while the visual targets evolve.
- The booking wizard has important production behavior in its existing hooks/state machine; layout changes cannot break form progression, confirmation, or recovery behavior.
- `/bookings/[bookingId]/thank-you` redirects to `/guest/bookings/[bookingId]/receipt`; if that receipt surface is left behind visually, the journey will still feel inconsistent.

## Open Questions (owner, due)

- Q: Should `/guest/bookings` and the receipt target be refreshed alongside the listed public routes for end-to-end consistency?
  A: Proceed as yes for shared surfaces used by the preserved redirects and guest-management flow, while keeping route behavior unchanged. Owner: github:@amanshresthaa, due: 2026-04-11.

## Recommended Direction (with rationale)

- Rebuild the booking journey at the shared-component layer first:
  - Introduce a clearer shared guest booking UI language for hero, status, actions, and info sections.
  - Refresh the canonical wizard shell/steps to feel editorial and calm without changing booking state logic.
  - Replace the generic thank-you and recovery-error treatments with route-appropriate, design-system-native compositions.
- Use the preset selectively:
  - Borrow guest-safe layout, token, radius, spacing, and component-composition ideas where they support the design system.
  - Do not change app-wide Shadcn base, alias structure, or non-guest routes/components.
- Keep routes thin and preserve redirects exactly, so behavior remains stable while the visual system becomes consistent across entry, booking, confirmation, detail, and receipt surfaces.
