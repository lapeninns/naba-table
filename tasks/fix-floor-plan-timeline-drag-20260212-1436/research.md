---
task: fix-floor-plan-timeline-drag
timestamp_utc: 2026-02-12T14:36:09Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Floor Plan Timeline Drag Should Not Pan Canvas

## Requirements

- Functional:
  - Dragging the timeline scrubber on `http://localhost:3000/app/floor-plan` must update the selected time without panning the floor canvas.
  - Dragging the canvas background must still pan the canvas.
  - Clicking/dragging tables continues to behave as before (no regressions in selection).
- Non-functional:
  - Accessibility: timeline remains operable via keyboard, buttons remain focusable, no broken focus handling.
  - Performance: no extra global listeners or heavy re-render paths introduced.

## Existing Patterns & Reuse

- Canvas panning is implemented via pointer events on the canvas container in:
  - `src/components/features/seating/FloorPlanPage.tsx`
  - Handler: `handlePointerDown` calls `setPointerCapture` + toggles `isDragging`.
- Timeline scrubber UI is a `TimeScrubber` component in the same file, using an `<input type="range">`.

## Root Cause

- The canvas container listens to `onPointerDown`.
- The timeline `<input type="range">` sits inside the canvas container (overlay), and its pointer events bubble.
- As a result, pointer down on the timeline starts canvas drag (pointer capture), so subsequent pointer moves update pan.

## Constraints & Risks

- Changes must remain local/canonical (avoid duplicate drag systems).
- Don’t break other interactive controls inside the canvas overlay (zoom buttons, timeline step buttons).
- Ensure the fix works with pointer events (mouse + touch).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Gate canvas pan start: do not start panning if pointer originates inside interactive UI within the canvas overlay (timeline scrubber, buttons, inputs).
- Additionally, stop pointerdown propagation inside the `TimeScrubber` so the canvas container never receives the initiating event.
  - Rationale: robust fix against future refactors and avoids relying on brittle hit-testing.
