---
task: auth-final-verification
timestamp_utc: 2026-01-04T16:30:00Z
owner: github:@opencode
---

# Implementation Plan: Auth Final Verification

## Objective

Finalize the auth hub migration and branding standardization.

## Success Criteria

- [ ] `ImplicitAuthHandler.tsx` handles `redirectedFrom`.
- [ ] `docs/restaurant-facing-routes.md` is updated.
- [ ] Legacy logo paths are removed.
- [ ] E2E flow verified.

## Architecture & Components

- `ImplicitAuthHandler.tsx`: Post-login redirect logic.
- `BrandIcon.tsx`: Logo SVG path source.

## Testing Strategy

- Manual verification of redirection.
- Grep for legacy strings.

## Rollout

- Immediate application as these are final verification and documentation tasks.
