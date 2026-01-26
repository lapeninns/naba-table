---
task: feature-inventory
timestamp_utc: 2026-01-26T13:46:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops + Guest Feature Inventory

## Requirements

- Functional:
  - Inventory all ops and guest features across UI, APIs, background jobs, and feature flags.
  - Group features by domain category.
  - Provide entry points and source file paths for each feature.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Documentation-only output; no runtime changes.

## Existing Patterns & Reuse

- Route documentation: `docs/ROUTING.md`, `docs/current-routes.md`, `route-map-ascii.txt`.
- Ops nav: `src/components/features/ops-shell/navigation.tsx`.
- Guest nav: `src/components/layouts/GuestNavbar.tsx`.

## External Resources

- None required.

## Constraints & Risks

- Must follow AGENTS SDLC phases; task folder required.
- Inventory must avoid duplicates and internal-only helpers.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use route docs + code paths as the authoritative sources, normalize into a single registry, and export Markdown + CSV.
