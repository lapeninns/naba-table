---
task: auth-brand-cleanup
timestamp_utc: 2026-01-04T13:00:00Z
owner: github:opencode
risk: low
---

# Implementation Plan: Auth Brand Cleanup Finalization

## Objective

Finalize documentation and verify consistency across the codebase for the new auth and brand standards.

## Success Criteria

- `docs/restaurant-facing-routes.md` updated.
- `ImplicitAuthHandler.tsx` verified.
- No hardcoded legacy logo SVG paths found.
- No nested `<a>` tag errors in identified pages.

## Testing Strategy

- Manual verification of documentation.
- Grep for legacy patterns.
- Visual inspection of code for nesting issues.
