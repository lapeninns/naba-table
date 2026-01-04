---
task: fix-eslint-hooks-deps
timestamp_utc: 2026-01-04T19:01:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix ESLint hook deps warnings

## Requirements

- Functional:
  - Resolve ESLint hook dependency warnings blocking pre-commit.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No behavior regressions; avoid unnecessary renders.

## Existing Patterns & Reuse

- Use existing hook patterns in `src/hooks/ops` for memoizing query keys.
- Keep component callback dependencies accurate in `BookingAssignmentTabContent`.

## External Resources

- N/A

## Constraints & Risks

- Avoid changing behavior beyond dependency/memoization fixes.
- Ensure memoized values don't hide stale inputs.

## Open Questions (owner, due)

- Q: Should callbacks include `date` and `restaurantId` deps or be inlined? (owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Memoize `queryKey` with `useMemo` to stabilize effect deps.
- Include missing dependencies in `useCallback` or restructure to avoid stale values.
