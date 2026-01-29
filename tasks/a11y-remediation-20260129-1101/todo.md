---
task: a11y-remediation
timestamp_utc: 2026-01-29T11:01:00Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Identify remaining a11y offenders from Playwright report
- [x] Fix contrast issues (badges, footer, buttons)
- [x] Fix heading order on guest pages
- [x] Address landmark/region warnings if still present

## Tests

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm test:e2e:a11y`

## Manual QA

- [x] Chrome DevTools MCP snapshots + trace

## Notes

- Assumptions:
- Deviations:
