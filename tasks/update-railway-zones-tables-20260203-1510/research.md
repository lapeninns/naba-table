---
task: update-railway-zones-tables
timestamp_utc: 2026-02-03T15:10:44Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Update Railway Zones and Tables

## Requirements

- Functional:
  - Update zones and tables for The Railway Pub in production per provided counts and mobility rules.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes.
  - Production only.

## Existing Patterns & Reuse

- `zones` and `table_inventory` tables in Supabase.

## External Resources

- N/A

## Constraints & Risks

- Deleting/recreating zones/tables impacts bookings and allocations.
- Must avoid unintended deletes without explicit approval.

## Open Questions (owner, due)

- Q: Confirm zone 3 definition and zone names. (owner: github:@amankumarshrestha, due: 2026-02-03)
- Q: Confirm whether to delete and recreate existing zones/tables. (owner: github:@amankumarshrestha, due: 2026-02-03)
- Q: Confirm table numbering/labels and min/max party sizes. (owner: github:@amankumarshrestha, due: 2026-02-03)
- Q: Confirm allowed capacities list. (owner: github:@amankumarshrestha, due: 2026-02-03)

## Recommended Direction (with rationale)

- Use a scripted update that replaces zones/tables after approval, mirroring existing schema defaults.
