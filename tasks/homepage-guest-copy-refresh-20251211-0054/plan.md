---
task: homepage-guest-copy-refresh
timestamp_utc: 2025-12-11T00:54:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Homepage guest copy refresh

## Objective

Refresh the public homepage copy to clearly communicate fast restaurant table reservations for guests, following the provided headline/benefit playbook.

## Success Criteria

- [ ] Hero headline and subheader reflect the new restaurant-guest messaging.
- [ ] CTA text and trust statements updated without breaking layout or a11y.
- [ ] Mid-page testimonial, benefit blurbs, and pre-final stat reflect new copy.

## Architecture & Components

- `src/app/(public)/page.tsx` — main marketing page using existing layout and components.

## Data Flow & API Contracts

- No data/API changes; text-only update.

## UI/UX States

- Static content; ensure responsive layout remains intact.

## Edge Cases

- None expected; verify text fits on mobile without overflow.

## Testing Strategy

- Manual smoke of `/(public)` homepage on desktop and mobile widths.
- Quick accessibility check (keyboard nav, visible focus on CTA).

## Rollout

- Single release; no flags required.

## DB Change Plan (if applicable)

- Not applicable (copy-only change).
