---
task: floor-plan-occupancy-board-redesign
timestamp_utc: 2026-04-03T16:07:37Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Rebuild `FloorCanvas` composition around a single dominant map stage.
- [x] Re-skin `TimeScrubber` into the new board language without changing its external API.

## Core

- [x] Derive higher-order occupancy signals from the existing status buckets.
- [x] Keep table selection, pan, zoom, and reset behavior intact.

## UI/UX

- [x] Replace card-stack hierarchy with a clearer spatial layout and utility copy.
- [x] Preserve visible legend semantics and empty-search feedback.
- [x] Maintain accessible labels, keyboard behavior, and touch-safe controls.

## Tests

- [x] Update focused `FloorCanvas` expectations.
- [x] Re-run `FloorPlanTable` regression proof.

## Notes

- Assumptions: redesign is a UI-only rewrite on the existing floor-plan path.
- Deviations: browser verification is still pending while the app is restarted after the automated validation pass.

## Batched Questions

- None at the moment.
