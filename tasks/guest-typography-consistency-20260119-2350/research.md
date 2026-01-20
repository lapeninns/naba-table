---
task: guest-typography-consistency
timestamp_utc: 2026-01-19T23:51:09Z
owner: github:@codex
reviewers: [github:@guest-experience]
risk: low
flags: []
related_tickets: []
---

# Research: Guest App Typography Consistency

## Requirements

- Functional:
  - Make guest app typography consistent across dashboard/profile and shared guest primitives.
  - Use existing guest theme typography tokens/utilities where possible.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain readability and hierarchy across breakpoints.
  - Preserve accessibility and existing layout behavior.

## Existing Patterns & Reuse

- `styles/themes/guest-enhanced.css` defines `heading-hero`, `heading-section`, `heading-subsection`, `text-body-warm`.
- `src/app/globals.css` defines guest typography scale variables and baseline heading styles.
- `src/components/guest/ui/GuestPrimitives.tsx` provides `HeadingXL/LG/MD` and `TextBody` but uses hard-coded sizes/colors.

## Constraints & Risks

- Keep scope limited to guest app typography; avoid unrelated UX changes.
- Must follow SDLC phases; no code changes before plan review.
- UI changes require Chrome DevTools MCP QA artifacts.

## Open Questions (owner, due)

- Q: Include guest pages under `src/app/guest/**` (bookings list/receipt)?
  A: UNCONFIRMED (needs user input).

## Recommended Direction (with rationale)

- Align guest primitives and page headings to shared guest typography utilities to reduce ad-hoc sizing and keep hierarchy consistent.
- Add `text-wrap: balance` to heading utilities to improve line breaks on narrow viewports.
