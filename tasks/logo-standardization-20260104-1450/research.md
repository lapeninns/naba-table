---
task: logo-standardization
timestamp_utc: 2026-01-04T14:50:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Logo Standardization

## Requirements

- Functional:
  - Centralize the "Nab a Table" logo with the "beta" badge.
  - The logo must act as a context-aware Home link.
  - Landing/Marketing pages: Link to `/`.
  - Auth-related pages: Link to `/auth`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Accessible link with hover effects.
  - Consistent branding across all modules.

## Existing Patterns & Reuse

- `src/components/shared/BrandLogo.tsx` is already created and used in some layouts.
- `BrandIcon` is used for the SVG part.

## External Resources

- N/A

## Constraints & Risks

- Ensure all instances of hardcoded logos are replaced.
- Ensure the link destination is correct for the specific layout.

## Open Questions (owner, due)

- Are there any pages where the "beta" badge should NOT be shown? (Assumed footer for now).

## Recommended Direction (with rationale)

- Use the existing `BrandLogo` component.
- Swap hardcoded logos in `AuthNavbar.tsx`, `Footer.tsx`, and check `OwnerMarketingNavbar.tsx`.
