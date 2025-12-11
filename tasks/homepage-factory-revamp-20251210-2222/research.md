---
task: homepage-factory-revamp
timestamp_utc: 2025-12-10T22:22:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Homepage Factory-style revamp

## Requirements

- Functional:
  - Redesign the public homepage to match the Factory design (hero with floating search, live feed, bento metrics, receipts feature block, rich footer).
  - Keep primary CTAs to Find a Table, View My Bookings, and Sign In; preserve auth-aware behavior where relevant.
  - Maintain accessibility (headings, labels, focus states) and responsiveness.
- Non-functional:
  - Align with Factory design tokens (slate + brand blue, Inter type scale) without breaking existing global theming.
  - No backend changes; page remains static apart from auth-aware CTAs and live-feed animation.
  - Avoid regressions to other marketing pages; scope changes to home route and new components.

## Existing Patterns & Reuse

- Current home page uses `src/components/landing/HomeSections.tsx` composed inside `MarketingLayout` (GuestNavbar, GuestBackground, Footer).
- Factory reference implementation already built in `/dev/factory-landing` (`src/app/dev/factory-landing/page.tsx`) with scoped tokens, hero, search pills, live feed, bento metrics, and feature section.
- Theme provider for marketing pages lives in `MarketingLayout`; `GuestNavbar` and `Footer` provide shared chrome.

## External Resources

- User-provided Factory design snippet (same as `/dev/factory-landing`). No additional external specs.
- Augment MCP not available in this environment; relying on direct code inspection and existing reference implementation for grounding.

## Constraints & Risks

- Need to avoid double navigation/footer when embedding new design alongside `MarketingLayout` chrome.
- Scoped CSS variables must not leak or override existing global tokens.
- Live feed uses client-side state; needs a client component without converting the entire page to client and losing server-side auth detection.

## Open Questions (owner, due)

- Should we keep GuestNavbar/Footer or replace with Factory versions? Assumption: keep shared chrome for consistency, embed Factory hero/sections inside.

## Recommended Direction (with rationale)

- Create a dedicated client component for the Factory-styled homepage that reuses the reference layout and tokens but is wrapped by the existing marketing shell for background/theme consistency.
- Keep server-side auth check in `page.tsx` and pass `isAuthenticated` to toggle the auth CTA label/target.
- Capture updated screenshots after the revamp and store in `tasks/homepage-factory-revamp-20251210-2222/artifacts/`.
