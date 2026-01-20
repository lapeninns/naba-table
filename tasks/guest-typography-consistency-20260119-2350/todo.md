---
task: guest-typography-consistency
timestamp_utc: 2026-01-19T23:51:09Z
owner: github:@codex
reviewers: [github:@guest-experience]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm scope (dashboard/profile only vs. include `src/app/guest/**`).
- [x] Align on guest typography utilities to standardize.

## Core

- [x] Update guest theme typography utilities for balanced wrapping.
- [x] Update GuestPrimitives to use shared utilities/tokens.
- [x] Update guest dashboard/profile headings to shared utilities.

## UI/UX

- [ ] Verify typography hierarchy on mobile/tablet/desktop.

## Tests

- [x] Chrome DevTools MCP manual QA with screenshots (guest routes).
- [ ] Capture Lighthouse JSON + HAR.

## Notes

- Assumptions:
- Deviations:
