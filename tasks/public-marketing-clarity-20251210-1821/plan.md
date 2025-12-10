---
task: public-marketing-clarity
timestamp_utc: 2025-12-10T18:21:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Public marketing + booking clarity

## Objective

Make public marketing and booking pages faster to scan with clear CTAs, reduced copy, and consistent visuals (including lightweight SVGs) while keeping flows intact.

## Success Criteria

- [ ] Each target page shows a concise headline + 1–2 line supporting text.
- [ ] Primary CTA(s) per page remain obvious on mobile and desktop.
- [ ] Trust/confirmation cues preserved but not verbose.
- [ ] No new design tokens or performance regressions; MCP a11y check passes on sampled pages.

## Architecture & Components

- Reuse existing marketing and booking components in `src/components` (landing, marketing, booking features, auth).
- Introduce small inline SVG motifs where helpful (hero/header cards) using design-system colors.
- Keep layouts via existing `MarketingLayout` / booking layouts.

## Data Flow & API Contracts

- No API contract changes; ensure search/booking/manage flows remain functional.

## UI/UX States

- Preserve existing loading/empty/error states; tighten copy within those components only if non-functional.

## Edge Cases

- Do not remove required legal/policy text (confirm before trimming if encountered).
- Maintain keyboard/focus flows for forms and steps (wizard/manage pages).

## Testing Strategy

- Manual QA + axe via Chrome DevTools MCP on representative pages (/restaurants, /restaurants/[slug], /restaurants/[slug]/book, /bookings/[id]/manage, /auth/signin).
- Smoke booking happy path to ensure no broken navigation.

## Rollout

- No feature flag planned; ship once verified.
- Revert commit as kill-switch if issues appear.

## DB Change Plan (if applicable)

- Not applicable (UI/content only).
