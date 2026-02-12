---
task: fix-floor-plan-timeline-drag
timestamp_utc: 2026-02-12T14:36:09Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify canvas pan handler and timeline scrubber component in `src/components/features/seating/FloorPlanPage.tsx`.

## Core

- [x] Add `data-prevent-canvas-pan` and stop-propagation handler to `TimeScrubber`.
- [x] Update canvas `handlePointerDown` to ignore pointer events originating from scrubber/interactive UI.

## Verification

- [x] Chrome DevTools MCP manual QA on `/dev/ops-floor-plan` (auth-free harness for `/app/floor-plan`).
- [x] Capture artifacts (screenshots, console log snapshot).
- [x] Complete `verification.md`.
