---
task: b2b-landing-content
timestamp_utc: 2026-01-02T21:15:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: B2B Landing Content Extraction

## Requirements

- Functional:
  - Extract real features and benefits from code (components, types, API routes, business logic).
  - Produce a JSON object keyed by section and save it to the repo root.
- Non-functional (a11y, perf, security, i18n):
  - No invented capabilities; cite only what exists in code.
  - Avoid touching README/docs beyond required task artifacts.

## Existing Patterns & Reuse

- `src/components/features/` for feature surface areas (bookings, customers, tables, floor plan).
- `src/types/ops.ts` for customer/booking data points.
- `src/app/api/bookings/route.ts` for booking intake and auto-assign flow.
- `server/capacity/table-assignment/*` for assignment checks and holds.
- `lib/env.ts` for system limits (hold TTL, auto-assign timeout).

## External Resources

- None.

## Constraints & Risks

- Must reflect only code-backed behavior and limits.
- Must run lint/typecheck/tests after generating JSON.

## Open Questions (owner, due)

- Preferred output filename for the root JSON? (owner: github:@amanshresthaa, due: 2026-01-02)

## Recommended Direction (with rationale)

- Use component/type names to define feature grid and CRM data points.
- Use booking API + auto-assign pipeline for the workflow narrative.
- Use constants in capacity/holds/env for a concrete hero stat.
