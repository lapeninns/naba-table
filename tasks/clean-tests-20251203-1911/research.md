---
task: clean-tests
timestamp_utc: 2025-12-03T19:11:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Remove Tests From Repo

## Requirements

- Functional: Remove all first-party test directories and test artifacts from the repository per user request.
- Non-functional: Avoid touching dependencies (`node_modules`) or unrelated build tooling; maintain repo integrity and AGENTS policies.

## Existing Patterns & Reuse

- Tests are colocated under `__tests__` folders and occasional `tests` roots (e.g., `server/__tests__`, `reserve/tests`).
- Some test-only API routes live under `src/app/api/test/*` (likely for Playwright/e2e helpers).

## External Resources

- None needed; task is repository-scoped.

## Constraints & Risks

- Destructive action; cannot be easily undone without VCS history.
- Removing `src/app/api/test/*` may break any automation relying on those helper endpoints.
- Deleting tests reduces safety net; future changes lose coverage.
- Must leave third-party package contents untouched (avoid `node_modules` modifications).

## Open Questions (owner, due)

- Should dependency/bundle artifacts like `.next` be cleaned as part of "results"? (Assumption: yes, safe to remove build outputs.)
- Are test helper API routes (`src/app/api/test`) still needed by CI? (Assumption: user wants them removed.)

## Recommended Direction (with rationale)

- Target only first-party test directories and obvious test artifacts (coverage/playwright reports) while excluding `node_modules` and other vendor trees.
- Remove `src/app/api/test/*` alongside `__tests__`/`tests` folders to meet "all test folder" request.
- After deletion, verify via `find` that no first-party test directories remain.
