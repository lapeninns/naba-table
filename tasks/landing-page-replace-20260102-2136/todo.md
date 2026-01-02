---
task: landing-page-replace
timestamp_utc: 2026-01-02T21:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts directory
- [x] Review AGENTS policies for landing components

## Core

- [x] Replace `FactoryHomeClient` layout and copy
- [x] Use Shadcn Button and Badge primitives
- [x] Respect prefers-reduced-motion for reveals and live feed rotation
- [x] Run lint: `pnpm run lint` (warnings present; see verification)
- [x] Run typecheck: `pnpm run typecheck`
- [x] Run tests: `pnpm run test` (failures present; see verification)

## UI/UX

- [ ] Chrome DevTools MCP manual QA (console/network/a11y/perf)
- [ ] Capture artifacts in `artifacts/`

## Notes

- Assumptions: No new data sources required; landing page is static.
- Deviations: Inline styles used for theme variables and staggered reveal delays.
- Test status: API route tests failing pre-existing; not addressed in this change.
