---
task: floor-plan-occupancy-board-redesign
timestamp_utc: 2026-04-03T16:07:37Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Occupancy Board Redesign

## Requirements

- Functional:
- Redesign the Occupancy board from scratch on the canonical authenticated floor-plan surface.
- Preserve the existing read-only behavior, table selection, pan/zoom, and timeline scrubbing.
- Keep the redesign on the production floor-plan path instead of introducing a side route or duplicate component tree.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keyboard navigation for pan, zoom, and timeline controls must remain intact.
- The surface should use utility-first operational copy rather than homepage-style marketing language.
- The layout should reduce card clutter, improve hierarchy, and remain usable across mobile and desktop.
- No API, database, migration, or auth changes are in scope.

## Existing Patterns & Reuse

- `src/components/features/seating/floor-plan/components/FloorCanvas.tsx` is the canonical occupancy board shell and already owns pan, zoom, legend, and timeline composition.
- `src/components/features/seating/floor-plan/components/FloorPlanTable.tsx` is the canonical table interaction target and should be reused without reintroducing the previous target-size regression.
- `src/components/features/seating/floor-plan/components/TimeScrubber.tsx` is the canonical timeline control and can be visually rebuilt without changing its API.
- `src/components/features/seating/floor-plan/lib/status.ts` already centralizes status labels and dots and should stay the single source of truth for occupancy semantics.

## External Resources

- [`frontend-skill`](file:///Users/amankumarshrestha/.codex/skills/frontend-skill/SKILL.md) — establishes the redesign bar: cardless composition, one dominant visual plane, utility copy for product UI, and deliberate motion.

## Constraints & Risks

- The route was recently stabilized after an authenticated reload issue; the redesign cannot regress loading, selection, or keyboard behavior.
- Existing floor-plan tests assert current summary strings, so the semantic copy update will require coordinated test updates.
- The board needs stronger art direction without becoming decorative or compromising readability over the map surface.

## Open Questions (owner, due)

- Q: Should the redesign alter table geometry or only the surrounding board composition?
  A: Keep table geometry stable for this pass and redesign the board composition around it. Owner: agent. Due: during implementation.

## Recommended Direction (with rationale)

- Rebuild the board as a dark, cardless operations stage with one dominant map plane, a compact command rail, and a grounded timeline dock.
- Derive a small set of higher-order service signals from the existing occupancy buckets so the surface helps operators read the room at a glance instead of parsing five equivalent tiles.
- Keep the interaction model familiar while making the visual hierarchy more intentional and spatially coherent.
