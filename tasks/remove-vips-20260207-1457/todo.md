---
task: remove-vips
timestamp_utc: 2026-02-07T14:57:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm all governing `AGENTS.md` for touched paths
- [x] Confirm `trash` is available for deletions

## Core Removal

- [x] Remove Next.js route handler: `src/app/api/ops/dashboard/vips/route.ts`
- [x] Remove hook: `src/hooks/ops/useOpsTodayVIPs.ts`
- [x] Remove server op: `server/ops/vips.ts`

## Callers

- [x] Remove/patch any remaining imports to the deleted modules
- [x] Remove/patch any remaining `/api/ops/dashboard/vips` callers

## Verification

- [x] Typecheck
- [x] Lint
- [x] Chrome DevTools MCP manual smoke (console/network)

## Notes

- Assumptions: VIPs are dead code (server op already returns empty) and have no remaining UI surface beyond route/hook.
- Deviations: none.
