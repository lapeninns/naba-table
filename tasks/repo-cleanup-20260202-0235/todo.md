---
task: repo-cleanup
timestamp_utc: 2026-02-02T02:35:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts directory.

## Core

- [x] Remove confirmed dead files.
- [x] Remove unused dependencies from `package.json`.
- [ ] Update `.gitignore` for generated artifacts. (Skipped: task artifacts are required to be committed.)

## Tests

- [x] Run lint/typecheck/test/build.

## Notes

- Assumptions: cleanup limited to confirmed unused files; no UI change.
- Deviations: Skipped `.gitignore` update to preserve task artifacts in VCS.
