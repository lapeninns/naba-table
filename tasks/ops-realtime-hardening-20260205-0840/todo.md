---
task: ops-realtime-hardening
timestamp_utc: 2026-02-05T08:41:15Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add centralized realtime constants in `lib/ops/realtime.ts`.

## Core

- [x] Debounce summary invalidations in `useOpsTodaySummary`.
- [x] Add 3-minute safety poll when realtime is healthy and tab is visible.

## UI/UX

- [x] Pass summary `dataUpdatedAt` through dashboard state to header.
- [x] Show freshness and stale state in `ConnectionStatusBeacon`.

## Tests

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.

## Notes

- Assumptions: 3-minute safety poll, 250ms debounce, 6-minute stale threshold.
- Deviations: None.

## Batched Questions

- None.
