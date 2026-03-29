---
task: update-booking-card-tests
timestamp_utc: 2026-03-29T23:05:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Update booking card tests

## Requirements

- Functional:
  - Refresh booking card tests for the rebuilt logic contract and stale expectations.
  - Cover normalized view-model inputs, action policy, pending mutation behavior, and selector/component expectations listed in the request.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessible button/link semantics in tests.
  - Keep test coverage focused and deterministic.

## Existing Patterns & Reuse

- Pending

## External Resources

- None

## Constraints & Risks

- Tests likely span both pure view-model helpers and rendered card behavior; stale expectations may hide real contract changes.
- Need to avoid broad production refactors unless a broken test helper or fixture requires a small aligned cleanup.

## Open Questions (owner, due)

- Q: Are source fixes needed, or is this fully stale-test fallout?
  A: Inspect current implementation and failing/affected tests first.

## Recommended Direction (with rationale)

- Update tests to match the canonical card contract, expanding pure helper coverage first and then tightening rendered-state assertions around action policy and pending mutations.
