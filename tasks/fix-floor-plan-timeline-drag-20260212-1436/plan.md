---
task: fix-floor-plan-timeline-drag
timestamp_utc: 2026-02-12T14:36:09Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Timeline Drag Should Not Pan Canvas

## Objective

Enable users to adjust the time via the timeline scrubber on `/app/floor-plan` without unintentionally panning the floor plan canvas.

## Success Criteria

- [ ] Dragging the timeline scrubber changes time only (canvas pan unchanged).
- [ ] Dragging background still pans the canvas.
- [ ] Clicking tables still selects/deselects as before.
- [ ] No new console errors/warnings introduced during interaction.

## Architecture & Components

- `FloorPlanPage` (`src/components/features/seating/FloorPlanPage.tsx`)
  - Canvas pan handlers: `handlePointerDown/Move/Up`
  - Timeline UI: `TimeScrubber`

## Design

1. Add an explicit “do not start canvas pan from here” marker (`data-prevent-canvas-pan`) on `TimeScrubber`.
2. Update `handlePointerDown` to return early when the pointer target is within:
   - a table (`[data-table-id]`) (existing), or
   - an element marked `data-prevent-canvas-pan`, or
   - standard interactive controls (`button`, `input`, etc.) in the overlay.
3. Add `onPointerDownCapture` to `TimeScrubber` root to stop propagation as a defense-in-depth.

## Testing Strategy

- Manual (required): Chrome DevTools MCP on `http://localhost:3000/app/floor-plan`
  - Drag scrubber: time changes; pan stays fixed.
  - Drag background: pan changes.
  - Click table: selects; does not pan.
  - Click zoom and step buttons: no pan.
  - Mobile emulation: scrubber drag still works.

## Rollout

- No feature flag. This is a bug fix with low blast radius, scoped to `/app/floor-plan`.
