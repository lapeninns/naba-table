---
task: deep-repo-cleanup
timestamp_utc: 2026-02-02T02:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts directory.

## Core

- [x] Remove unused scripts and generated docs with reference updates.
- [x] Remove additional unused deps and update lockfile.
- [x] Update `.gitignore` to prevent reintroducing generated artifacts.

## Tests

- [x] Run lint/typecheck/test/build.

## Notes

- Assumptions: deep cleanup excludes task artifacts and active backups required by policy.
- Deviations: None.
