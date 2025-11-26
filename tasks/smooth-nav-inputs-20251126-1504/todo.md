---
task: smooth-nav-inputs
timestamp_utc: 2025-11-26T15:04:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm existing prefetch usage and query key coverage.
- [ ] Locate current keyboard shortcut handling (if any) and command palette.
- [ ] Identify search/filter inputs and resize/scroll handlers to debounce/throttle.
- [ ] Inventory targeted forms (profile, hours, service periods) and current form libs.

## Core

- [ ] Add `lib/prefetchers.ts` helper and wire to settings sidebar hover/focus, dashboard tabs, calendar next month, restaurant switcher, booking wizard step transitions.
- [ ] Implement `useGlobalShortcuts` hook + scope bindings for save/new/close/palette/arrows; add UI hints.
- [ ] Add `utils/debounceThrottle.ts` and apply to search/filter inputs and resize/scroll handlers.
- [ ] Refactor key forms to react-hook-form with `mode: 'onBlur'`, sectioned layout, and minimal Controllers.

## Tests

- [ ] Unit tests for debounce/throttle and shortcut handling.
- [ ] Integration tests for one prefetch target (settings nav) and shortcut preventDefault (Ctrl+S).
- [ ] Manual QA with throttled network to verify prefetch cache hits.

## Notes

- Assumptions: No API contract changes; prefetch fetchers reuse existing services.
- Deviations: None yet.

## Batched Questions

- [ ] Confirm presence/absence of command palette to bind Cmd/Ctrl+K.
