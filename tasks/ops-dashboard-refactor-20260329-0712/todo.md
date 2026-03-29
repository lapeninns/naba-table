---
task: ops-dashboard-refactor
timestamp_utc: 2026-03-29T07:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Foundation

- [x] Create unified dashboard data hook and remove duplicate realtime ownership
- [x] Reuse the singleton browser Supabase client for realtime

## Server shaping

- [x] Normalize dashboard summary DTO for rendering
- [x] Preserve existing booking actions and route contract

## Client simplification

- [x] Reduce `useOpsDashboardState` responsibilities
- [x] Split dashboard state into query, data-state, and UI action layers
- [x] Move summary-derived guest counters and tab counts into shared selectors
- [x] Memoize dashboard client render boundaries with stable prop composition
- [x] Pass pre-shaped booking items into the list
- [x] Remove unnecessary row-level DTO work

## Cache consistency

- [x] Centralize dashboard summary total recomputation in a shared helper
- [x] Keep lifecycle and cancel mutations cache-consistent without broad bookings invalidation
- [x] Add direct regression coverage for summary booking patching

## List boundary reduction

- [x] Group dashboard list controls into a shared control contract
- [x] Flow booking row actions through a single internal action bag
- [x] Update dev harnesses and live route verification for the narrowed prop surface
- [x] Pre-shape booking card row view models before rendering dashboard list rows
- [x] Align the legacy `BookingsTable` ops-card path with the shared row view-model contract
- [x] Add focused regression coverage for booking card view-model derivation
- [x] Narrow booking card header, details, and action props to presentation-level inputs
- [x] Keep booking-object callback wiring at the card boundary only
- [x] Switch dashboard card actions to stable booking ID commands
- [x] Resolve dialog bookings from a shared dashboard booking lookup instead of flowing raw booking objects through the list/card path
- [x] Extract a shared dashboard booking-item mapper for row rendering and dialog hydration
- [x] Remove redundant dashboard summary refetches after lifecycle mutations that already patch cache state
- [x] Align undo-no-show lifecycle invalidation with the same patch-first summary strategy
- [x] Add hook coverage for dashboard booking actions pending-state behavior
- [x] Remove the dead dashboard dialog preload path from `BookingsList`
- [x] Clear the recurring `BookingDetailsDialog` preload warning from the dashboard route

## Verification

- [x] Run targeted tests
- [x] Verify dashboard behavior in browser
- [x] Record outcomes in `verification.md`
