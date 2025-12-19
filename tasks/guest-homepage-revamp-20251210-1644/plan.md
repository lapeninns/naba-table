---
task: guest-homepage-revamp
timestamp_utc: 2025-12-10T16:44:00Z
owner: github:@assistant
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Homepage Revamp

## Objective

Deliver a refreshed guest-facing homepage that leverages the existing design system and guest theme, clarifies the booking value proposition, and keeps primary CTAs intact.

## Success Criteria

- [ ] Hero, proof, journey, and CTA sections use only design system tokens/utilities (no new colors/radii/shadows/fonts).
- [ ] Primary CTAs link to `/restaurants`, `/auth/signin`, and `/guest/bookings`; SEO metadata preserved.
- [ ] Page remains responsive, keyboard-accessible, and passes DevTools MCP a11y/perf snapshot with no new console errors.

## Architecture & Components

- Keep `src/app/(public)/page.tsx` as a composition layer; continue exporting existing metadata.
- Redesign `src/components/landing/HomeSections.tsx` with four focused bands:
  1. **Hero** — split layout with search CTA, trust badge, and live availability card (uses Button, Input, Badge, Card).
  2. **Proof/Highlights** — metrics strip and mini “live feed” chips for credibility.
  3. **Journey + Benefits** — three-step walkthrough paired with benefits grid and iconography (lucide-react already in use).
  4. **CTA Strip** — bold gradient card with dual CTAs and key assurances.
- Keep content arrays (metrics, steps, benefits) co-located in the module for clarity.

## Data Flow & API Contracts

- No API calls; all content is static. Links point to existing routes. Form is non-submitting search CTA leading to `/restaurants`.

## UI/UX States

- Inputs labeled with `aria`/visible labels; ensure buttons have accessible names.
- Provide loading/empty/error semantics only if dynamic data is added later (not planned now).
- Responsive grids collapse to single column on small screens; maintain spacing tokens.

## Edge Cases

- Small screens: ensure hero card and metrics stack without overflow; text wraps gracefully.
- Reduced motion: rely on existing transition tokens; avoid custom animations.
- Ensure icons/CTAs remain visible on high-contrast backgrounds; preserve focus-visible rings.

## Testing Strategy

- `pnpm lint`, `pnpm test` (unit where relevant) after changes.
- Manual QA via Chrome DevTools MCP on `/`: keyboard navigation, responsive check (mobile/tablet/desktop), Lighthouse & HAR artifacts for perf/a11y.

## Rollout

- Direct merge (no flag). If issues arise, rollback by reverting the page component changes.
