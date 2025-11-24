---
task: disable-zones-tables
timestamp_utc: 2025-11-24T16:09:41Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Disable zones/tables for bookings

## Requirements

- Functional:
  - Restaurant staff can mark zones (e.g., Garden) as disabled; disabled zones' tables cannot receive new bookings (manual or auto assign).
  - Individual tables can be disabled (e.g., faulty). Disabled tables cannot receive new bookings.
  - Existing bookings already on a now-disabled table/zone must be surfaced for modification/reassignment.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve current assignment performance; avoid regressions in auto-assign loop.
  - Keep UI accessible (focus states, labels) if UI changes occur.
  - No secrets; follow existing patterns.

## Existing Patterns & Reuse

- To be confirmed during code inventory (look for booking assignment logic and table/zone models).

## External Resources

- None yet.

## Constraints & Risks

- Auto-assign algorithm complexity may be sensitive; need to avoid O(n^2) blowups with disabled filtering.
- Backward compatibility with existing data where disabled flag may be null/absent.
- Need to ensure UI prevents assignment without blocking existing legitimate workflows.

## Open Questions (owner, due)

- Should existing bookings on disabled tables auto-reassign or just flag for manual change? (Assume flag + require modification for now.)
- Are there admin permissions needed to toggle disable? (Assume current roles suffice.)

## Recommended Direction (with rationale)

- Add `disabled` flag to zones and tables (if not present) or reuse existing status fields.
- Filter disabled zones/tables out of both manual assignment pickers and auto-assign candidate sets.
- Add safeguard in backend assignment endpoint to reject assignments to disabled resources.
- Provide listing of bookings that reference disabled resources so staff can reassign.
