---
task: booking-card-revamp
timestamp_utc: 2026-01-21T01:10:36Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Booking Card Revamp

## Requirements

- Functional:
  - Revamp Ops booking card layout into a responsive multi-column grid (1–4 columns by breakpoint).
  - Group booking details by type: customer details/party/time/notes, table details, contact details, and booking meta.
  - Ensure it renders correctly on dashboard and bookings pages.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain semantic structure and accessible labels.
  - Preserve keyboard focus and action buttons.
  - Avoid new data exposure or PII leaks.

## Existing Patterns & Reuse

- Shared card component: `components/dashboard/OpsBookingCard.tsx` used by both ops dashboard and ops bookings page.
- Existing typography and spacing tokens in Tailwind classes; use shadcn/ui primitives already in place.

## External Resources

- N/A (no external specs required).

## Constraints & Risks

- Must follow AGENTS SDLC phases; no implementation before plan.
- UI change requires Chrome DevTools MCP QA with artifacts.
- Avoid introducing new primitives in legacy `components` folder unless necessary.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Refactor `OpsBookingCard` layout to a responsive CSS grid that collapses to 1–2 columns on smaller screens.
- Keep existing data fields/actions; only reorganize into grouped sections with headings for scanability.
