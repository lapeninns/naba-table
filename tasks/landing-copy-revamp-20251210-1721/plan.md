---
task: landing-copy-revamp
timestamp_utc: 2025-12-10T17:21:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Landing copy + layout revamp

## Objective

Revamp the guest-facing landing page using DesignSystem.md while keeping feature-grounded copy. Improve layout/sections without changing core logic.

## Success Criteria

- [ ] All hero, metrics, journey, CTA strings match landing-copy-sections.md.
- [ ] New layout stays within DesignSystem tokens (colors, radii, shadows, typography).
- [ ] No functionality regressions; navigation/CTAs unchanged.

## Architecture & Components

- HomeSections.tsx: HomeHeroSection, HomeMetricsSection, HomeTrustedSection, HomeJourneySection, HomeCTASection.
- Add a receipts/share-focused section leveraging existing UI primitives.

## Data Flow & API Contracts

- N/A (copy only).

## UI/UX States

- Ensure copy fits existing responsive layout.

## Edge Cases

- None beyond string length; keep CTA labels concise.

## Testing Strategy

- Visual smoke via dev server (not run here); static type unaffected.

## Rollout

- Direct update; no flags.
