---
task: dashboard-maintainability-refactor
timestamp_utc: 2026-03-19T11:03:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and task artifacts
- [x] Confirm dashboard files and local AGENTS scope

## Core

- [x] Extract dashboard query/date/search/sort state from `useOpsDashboardState`
- [x] Extract dashboard dialog state from `useOpsDashboardState`
- [x] Extract repeated booking lifecycle orchestration into a focused helper/hook
- [x] Simplify the dashboard date model by centralizing explicit-date versus active-date resolution
- [x] Keep the `useOpsDashboardState` return contract stable for existing consumers

## Tests

- [x] Add targeted tests for new helper logic if needed
- [x] Run focused dashboard test suite

## Notes

- Assumptions:
  - This pass should avoid product behavior changes and focus on internal maintainability.
- Deviations:
  - Existing dashboard utility tests plus the scoped realtime invalidation helper test were used as the primary regression net instead of introducing a full hook-level integration test.

## Batched Questions

- None at the moment.
