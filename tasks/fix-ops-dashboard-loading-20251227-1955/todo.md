---
task: fix-ops-dashboard-loading
timestamp_utc: 2025-12-27T19:55:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm effective AGENTS.md stack for touched files
- [x] Choose fix strategy (initial session hydration + query enablement)

## Core

- [x] Update session/query gating to avoid clearing in-flight summary
- [x] Restore missing query persistence module used by providers and navbar
- [ ] Ensure ops dashboard summary query resolves on first load

## UI/UX

- [ ] Loading/empty/error states unchanged
- [ ] A11y unaffected

## Tests

- [ ] Add/update unit tests if logic changes
- [ ] Run relevant test targets
- [ ] Manual QA via Chrome DevTools MCP

## Notes

- Assumptions:
- Deviations:
  - Fixed pre-commit lint warnings in existing files per user request to resolve CI-blocking ESLint warnings.

## Batched Questions

- None
