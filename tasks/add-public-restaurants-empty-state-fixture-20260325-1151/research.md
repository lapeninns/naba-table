---
task: add-public-restaurants-empty-state-fixture
timestamp_utc: 2026-03-25T11:52:14Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: add-public-restaurants-empty-state-fixture

## Requirements

- Add a deterministic local validation path for the public restaurants empty state.
- Keep the empty-state surface inside the guest design system with clear next steps.
- Fulfill `VAL-DISCOVERY-005`.

## Existing Patterns & Reuse

- Reuse `RestaurantsPage`, `RestaurantsHeroSection`, `RestaurantsGridSection`, and `GuestEmpty`.
- Reuse existing query-driven local validation fixture patterns used elsewhere in the repo.

## Constraints & Risks

- Scope must stay on public discovery surfaces only.
- Validators must include targeted Vitest, Playwright, typecheck, and lint.

## Recommended Direction

- Add a dev/test-only query fixture that forces `RestaurantsPage` to render with an empty restaurant list while preserving the same guest hero and empty-state card.
