---
task: edit-booking-scroll
timestamp_utc: 2025-12-02T01:40:03Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Edit booking dialog scroll fix

## Requirements

- Functional: Edit booking modal body should allow scrolling when content exceeds viewport height so form fields remain reachable.
- Non-functional: Maintain accessibility (keyboard/focus) and visual consistency; avoid regressions to modal sizing/position.

## Existing Patterns & Reuse

- Modal/dialog components already exist for booking editing; need to inspect current modal layout and container styling to reuse existing primitives and CSS utilities.

## External Resources

- N/A (internal UI tweak).

## Constraints & Risks

- Potential for scroll traps if dialog uses fixed height without focus management; ensure scroll area stays within modal and backdrop behaves.

## Open Questions (owner, due)

- None identified; will validate once component located.

## Recommended Direction (with rationale)

- Identify the edit booking modal component and wrap its body in a scrollable container with max-height tied to viewport (e.g., `max-h-[calc(100vh-...)]` or `overflow-y-auto`). Keep header/footer sticky or padded as per design so actions remain visible.
