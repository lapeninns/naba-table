---
task: luminous-booking-journey-redesign
timestamp_utc: 2026-04-11T17:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@guest-experience]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Save root guest-facing design system document
- [x] Amend guest-facing local guidance to reference the new design system source of truth
- [x] Add or update guest booking tokens/classes for tonal layering, glass surfaces, and editorial type

## Core

- [x] Redesign canonical booking wizard shell and sticky navigation
- [x] Redesign wizard step surfaces for plan, details, review, and confirmation
- [x] Redesign booking list and detail shared components
- [x] Redesign receipt and thank-you surfaces

## UI/UX

- [x] Replace visible divider-driven separation with tonal shifts and spacing
- [x] Apply consistent 0.625rem radius language where appropriate
- [x] Apply glass treatment to floating headers/navigation surfaces
- [x] Apply gradient CTA treatment for primary actions
- [x] Preserve focus management and mobile-safe-area behavior

## Tests

- [x] Lint or targeted static validation on changed files if feasible
- [x] Typecheck or targeted validation on changed paths if feasible
- [x] Chrome DevTools QA notes and artifacts

## Notes

- Assumptions:
  - The attached design system overrides prior guest aesthetic direction for this task.
  - Business logic and route contracts remain unchanged unless required for UI composition.
- Deviations:
  - Performance metrics were captured from a local dev trace because snapshot Lighthouse mode does not expose FCP/LCP/TBT budgets.
  - A dev-only Turbopack preload warning/404 remains visible on the public booking page, but the functional booking flow and accessibility checks pass.

## Batched Questions

- None at this stage.
