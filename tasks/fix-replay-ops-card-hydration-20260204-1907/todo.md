---
task: fix-replay-ops-card-hydration
timestamp_utc: 2026-02-04T19:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder + stubs

## Core

- [x] Add Replay guard on route transitions in `src/instrumentation-client.ts`
- [x] Make Ops booking card DOM stable across SSR/client

## UI/UX

- [ ] Confirm booking card details always visible on desktop
- [ ] Ensure mobile collapse toggle still works

## Tests

- [ ] Manual QA via Chrome DevTools MCP (mobile + desktop)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
