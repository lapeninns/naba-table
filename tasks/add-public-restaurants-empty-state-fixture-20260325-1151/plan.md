---
task: add-public-restaurants-empty-state-fixture
timestamp_utc: 2026-03-25T11:52:14Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: add-public-restaurants-empty-state-fixture

## Objective

Provide a deterministic local route/query for `/restaurants` that renders the calm guest empty state without depending on live data conditions.

## Success Criteria

- [ ] `/restaurants` supports a deterministic local empty-state validation path
- [ ] The empty-state UI remains guest-owned with clear CTAs
- [ ] Targeted tests cover the fixture path and browser validation route

## Architecture & Components

- Extend the restaurants page/server data path to honor a dev/test-only fixture query.
- Keep `RestaurantsHeroSection` and `RestaurantsGridSection` as the canonical UI components.
- Preserve the existing `GuestEmpty` content pattern for the zero-results state.

## Testing Strategy

- Add RED/GREEN Vitest coverage for the fixture query path.
- Add Playwright coverage for the deterministic empty-state route/query.
- Run targeted validations, then typecheck and lint.
