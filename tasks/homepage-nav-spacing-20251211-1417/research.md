---
task: homepage-nav-spacing
timestamp_utc: 2025-12-11T14:17:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Homepage navigation & spacing refresh

## Requirements

- Functional:
  - Reorder homepage sections by importance so the narrative flows from promise → proof → steps → features → reassurance → action.
  - Revamp the homepage navbar so its link order and labels mirror the section order/IDs on the page.
  - Normalize padding, margins, and whitespace across all homepage sections for consistent rhythm.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep keyboard/focus support for sticky navbar and mobile menu; maintain anchor targets for skip-like navigation.
  - Preserve responsive layout (mobile/tablet/desktop) and existing perf budgets; avoid new assets.
  - Keep current auth-aware redirect (authenticated users go to `/guest/dashboard`).

## Existing Patterns & Reuse

- Homepage route: `src/app/(public)/page.tsx` renders `MarketingLayout` (navbar/footer disabled) wrapping `FactoryHomeClient`.
- `FactoryHomeClient` (same file) owns the sticky navbar, section content, and footer; section IDs in use: `hero`, `metrics`, `how-it-works`, `benefits`, `testimonials`, `faq`, `cta`. Objection band is unlinked.
- Current NAV order: Overview → How it works → Live data → Benefits → Reviews → FAQ → Get started; real section order differs (Hero → Metrics → How it works → Testimonials → Benefits → FAQ → CTA) causing mismatch.
- Spacing helpers: `SECTION_CONTAINER = 'guest-boundary w-full'`; `SECTION_SPACING = 'py-12 sm:py-16 lg:py-20'`, but hero uses `pt-16 sm:pt-20`, objection band uses `py-4`, footer uses `pt-20 pb-10`, leading to inconsistent vertical rhythm.
- Design tokens/typography in `DesignSystem.md` and mirrored in `FactoryHomeClient` (`heading-*`, `text-body`, `shadow-card`, radius/brand tokens). Reuse these; avoid new colors/radii/shadows.

## External Resources

- None (in-repo design system + existing layout only).

## Constraints & Risks

- Sticky navbar must keep active-section tracking working after reordering/renaming anchors.
- Hero and CTA CTAs must keep existing hrefs (`/restaurants`, `/auth/signin` or `/guest/bookings`).
- Need to keep background/theme styling from `FactoryHomeClient` intact; avoid regressions to mobile menu accessibility.

## Open Questions (owner, due)

- Q: Should the objection band be included in nav? (Default: keep as supporting band without nav link.)
  A: Proceed without nav link to keep menu lean.

## Recommended Direction (with rationale)

- Set a single vertical spacing token (e.g., updated `SECTION_SPACING`) and apply to all major sections; align hero/footer top/bottom paddings to this rhythm.
- Reorder main sections to: Hero (#hero) → Metrics/Proof (#metrics) → How it works (#how-it-works) → Benefits/Feature (#benefits) → Testimonials (#testimonials) → FAQ (#faq) → Final CTA (#cta); keep ObjectionBand as a thin trust strip after hero.
- Update `NAV_LINKS` to match the above order/labels, and ensure active-state scroll spy still maps to section IDs.
- Normalize inner gaps (consistent `space-y`/`gap` values) without introducing new design tokens; reuse existing container + typography utilities.
