---
task: lint-cleanup
timestamp_utc: 2025-12-05T15:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Clear remaining lint errors/warnings from pre-commit

## Requirements

- Resolve the reported lint violations so `eslint --max-warnings=0` passes: unused imports/vars across guest/marketing pages, one hook dependency error, and a `no-explicit-any` in the e2e login route.

## Existing Patterns & Reuse

- Hooks should use inline dependency arrays for React lint rules; existing hook computes deps via helper.
- Unused props can be prefixed with `_` when signature must remain.

## Constraints & Risks

- Node engine mismatch warning (repo wants 20.11.1, current 22.12.0) will persist during lint runs.
- Large lint targets can SIGKILL; plan to run targeted file-level lint.

## Open Questions

- None for this scoped cleanup.

## Recommended Direction

- Remove unused imports/variables; prefix required-but-unused props with `_`.
- Inline `useMemo` dependency array in `useGuestBookings`.
- Replace `any[]` in e2e login route with a typed cookie array.
