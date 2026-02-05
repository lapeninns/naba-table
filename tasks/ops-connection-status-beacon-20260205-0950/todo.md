---
task: ops-connection-status-beacon
timestamp_utc: 2026-02-05T09:51:05Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC stubs.

## Core

- [x] Replace inline animation with Tailwind classes and status config map.
- [x] Add live relative time updates (15s interval).

## UI/UX

- [x] Two-row pill layout with badge + dot.
- [x] Bookings/Summary updated meta row + Sync indicator with separators.
- [x] A11y adjustments (aria-live, aria-hidden meta row, sr-only summary).

## Tests

- [x] Run `pnpm lint` (fails: existing import/order error in `server/jobs/auto-complete-bookings.ts`).
- [x] Run `pnpm typecheck` (fails: `src/instrumentation-client.ts` Replay type).
- [ ] Chrome DevTools MCP QA + artifacts (blocked by auth redirect; captured screenshot).

## Notes

- Assumptions: Status is driven by summary freshness; stale derived from `SUMMARY_STALE_AFTER_MS`.
- Deviations: None.
