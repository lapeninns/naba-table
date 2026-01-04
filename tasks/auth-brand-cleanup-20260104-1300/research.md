---
task: auth-brand-cleanup
timestamp_utc: 2026-01-04T13:00:00Z
owner: github:opencode
risk: low
---

# Research: Auth Brand Cleanup & Documentation Alignment

## Requirements

- Functional: Ensure all authentication entry points lead to `/auth`.
- Non-functional: Consistency in branding and documentation.

## Existing Patterns & Reuse

- `BrandLogo` component for all logo instances.
- Unified `/auth` route for role selection.

## Constraints & Risks

- Breaking redirect flows if search params are lost.
- Documentation mismatching implementation.

## Recommended Direction

- Update docs to reflect implementation.
- Audit remaining components for legacy auth/brand patterns.
