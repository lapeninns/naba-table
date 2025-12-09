---
task: guest-dashboard-revamp
timestamp_utc: 2025-12-09T17:36:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Dashboard Revamp

## Requirements

- Functional:
  - Refresh `/guest/dashboard` visuals and layout using the shared `DesignSystem.md` tokens/components.
  - Keep existing data flows (bookings, favorites, quick actions, profile greeting) intact.
  - Present primary/next booking, upcoming list, and favorites with clearer hierarchy and actionable buttons.
  - Preserve sharing/directions actions and navigation to bookings, history, profile, favorites.
- Non-functional (a11y, perf, security, i18n):
  - WCAG keyboard + focus-visible on all actions; semantic headings and lists.
  - Mobile-first layout with responsive grid breakpoints; avoid CLS by reserving space for cards/media.
  - Use design-system tokens/utilities (`heading-*`, `text-body`, `shadow-card`, `input-base`, radius, shadows) and guest theme variables.
  - Keep bundle impact low (reuse existing icons/components; avoid new deps); animations respect `prefers-reduced-motion` if added.
  - No secrets in code; auth/session handled by existing hooks.

## Existing Patterns & Reuse

- Page wiring: `src/app/guest/dashboard/page.tsx` → `GuestDashboardClient` via `GuestServicesProvider` and `HydrationBoundary`.
- UI primitives: `GuestSection`, `GuestCard`, `GuestEmpty`, `GuestError` in `src/components/guest/ui/GuestPrimitives.tsx` already align with guest tokens and can be reused.
- Data: hooks `useGuestBookings`, `useGuestProfile`, `useGuestSession`; booking state derivations in `booking-derivations.ts` (keeps live/next/upcoming/favorites logic).
- Styles/tokens: `DesignSystem.md` + `styles/guest-design-system.css` bridge the `.heading-*`, `.shadow-card`, `.input-base` utilities; guest theme/tokens live in `styles/tokens.css` and `guest-design-system.css`.
- Existing quick-action tile pattern and upcoming/favorite rows can be refined rather than rebuilt.

## External Resources

- `DesignSystem.md` — tokens, typography utilities, Button/Badge/MetricTile patterns; use to align cards/hero and button styling.
- `styles/guest-design-system.css` — guest theme classes that map DesignSystem utilities into the app’s CSS vars.

## Constraints & Risks

- Must not alter data fetching logic or query keys; keep `useGuestBookings` / profile hydration intact.
- Ensure empty/error states remain reachable and accessible; loading skeletons should preserve layout to avoid CLS.
- Quick actions and booking CTA URLs must remain accurate (`/`, `/guest/bookings`, `/guest/bookings?tab=history`, `/guest/profile`).
- Manual Chrome DevTools MCP QA required for UI changes per AGENTS; plan for Lighthouse/a11y artifacts.

## Open Questions (owner, due)

- Should the hero emphasize profile completion vs next booking? (owner: @assistant, due: before final implementation; propose next-booking-first)
- Is “Favorites” limited to top 3 or should we show more/CTA to list? (owner: @assistant, propose top 3 with link)
- Keep QR code dialog or replace with inline code? (owner: @assistant; default keep dialog)

## Recommended Direction (with rationale)

- Recompose dashboard using DesignSystem tokens: container width + vertical stacks, `heading-lg/md` for hero/sections, `text-body` for copy, `shadow-card` + `border` for cards.
- Elevate primary booking card as a “ticket” styled surface using design tokens but with reduced bespoke gradients; keep CTA trio (details/share/directions).
- Redesign quick actions into uniform pills using `Button`/`Badge` motifs from the design system to improve consistency.
- Present upcoming bookings and favorites in card lists with clear section headers/actions; reuse `GuestSection` but adjust internal spacing to match tokens.
- Maintain empty/loading states with skeleton placeholders sized to final layout.
