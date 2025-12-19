---
task: public-marketing-clarity
timestamp_utc: 2025-12-10T18:21:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Public marketing + booking pages clarity

## Requirements

- Functional:
  - Reduce text clutter and improve visual hierarchy across public routes:
    - / (landing)
    - /restaurants (listing)
    - /restaurants/[slug] (detail)
    - /restaurants/[slug]/book (wizard)
    - /restaurants/[slug]/book/thank-you (confirmation)
    - /bookings/[bookingId] (public detail)
    - /bookings/[bookingId]/manage (public manage)
    - /auth/signin (public access)
  - Keep core CTAs prominent and consistent; ensure flows remain functional.
  - Add lightweight SVG/illustrative elements where helpful without new tokens.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain a11y (keyboard, focus, labels) and avoid new blocking assets.
  - Respect design system tokens; no new colors/fonts.
  - Keep copy concise for scanability, especially on mobile.

## Existing Patterns & Reuse

- Landing already uses `Home*Section` components in `src/components/landing/HomeSections.tsx` (recently simplified).
- Marketing pages likely composed under `src/app/(public)/(marketing)/restaurants/**`.
- Booking pages use shared booking components under `src/components/features/booking` (to confirm via code scan).
- Auth uses existing SignIn components in `components/auth` and shared layouts.

## External Resources

- None planned; reuse in-repo design system and components.

## Constraints & Risks

- Must adhere to AGENTS root and `src/app`/`src/components` rules; design-system-only styling.
- UI changes require Chrome DevTools MCP verification for at least representative pages.
- Risk of copy cuts removing key reassurance; ensure essentials kept (trust badges, region, confirmation cues).

## Open Questions (owner, due)

- Should restaurant listing/detail retain all current filters/cards, or can we collapse secondary metadata? (Pending maintainer, asap)
- Any legal copy that must remain (e.g., cancellation policy text)? (Pending maintainer, asap)

## Recommended Direction (with rationale)

- Apply a consistent clarity pattern: concise headers, 1–2 line body, limited chips/pills, and optional inline SVG hero motifs.
- Keep CTAs per page primary path (search → select → book → receipt; view/manage bookings; sign in) with minimal surrounding text.
- Use existing cards/badges/buttons; trim lists and repetitive bullets.
