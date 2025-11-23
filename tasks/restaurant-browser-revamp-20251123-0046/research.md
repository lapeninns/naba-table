---
task: restaurant-browser-revamp
timestamp_utc: 2025-11-23T00:46:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: RestaurantBrowser Revamp

## Requirements

- Functional:
  - Provide mobile-first, fully responsive restaurant browsing and booking entry point.
  - Preserve existing guest-facing marketing copy but allow new layout/visual hierarchy.
  - Support filtering by search text, timezone, and minimum seats (existing contract), with room for future facets.
  - Display clear calls to action for booking; keep analytics on list view, selection, errors, and empty states.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain WCAG keyboard navigation, visible focus, aria labels.
  - Meet existing perf budgets (FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms on mobile 4×CPU, 4G).
  - No secrets in source; respect existing Supabase remote-only rules.
  - Text remains in English; keep copy stable.

## Existing Patterns & Reuse

- Use existing Shadcn UI atoms (`Card`, `Badge`, `Button`, `Input`, `Label`, `Skeleton`).
- Reuse `useRestaurants` query hook and `fetchRestaurants` API; no backend changes planned.
- Keep analytics helper `track` and event names already present.

## External Resources

- None needed beyond existing design system.

## Constraints & Risks

- Must follow AGENTS.md SDLC; manual Chrome DevTools QA required for UI changes.
- Need to avoid CLS by reserving media space; ensure list virtualization not required for small dataset.
- Mobile-first redesign could introduce focus traps if not careful; must test keyboard + screen reader labels.

## Open Questions (owner, due)

- Q: Are hero images or new data fields allowed later? (Owner: product; due: post-revamp) — proceed with current fields only.

## Recommended Direction (with rationale)

- Build a card-based, mobile-first layout with sticky filter bar on small screens and multi-column grid on desktop for better conversion.
- Add quick chips for common timezone/min-cap filters to reduce typing on mobile.
- Keep copy but re-order for scannability; emphasize CTA with clear hierarchy and secondary action.
- Maintain existing analytics events; add optional feature flag `feat.restaurantBrowser.revamp` for safe rollout.
