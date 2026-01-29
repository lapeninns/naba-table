---
task: feature-flag-cleanup
timestamp_utc: 2026-01-29T15:23:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Feature Flag Cleanup

## Requirements

- Functional: Remove unused flag paths reported by `flags:audit` from env definitions and test mocks.
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes; no secrets.

## Existing Patterns & Reuse

- Feature flags defined in `lib/env.ts` (`env.featureFlags`) and `lib/env-client.ts` (`clientEnv.flags`).

## External Resources

- None required.

## Constraints & Risks

- Keep any still-used env vars intact; only prune unused flag paths.
- Run validators after changes.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove unused flag entries from `env.featureFlags` and `clientEnv.flags` and align test mocks so the audit passes cleanly.
