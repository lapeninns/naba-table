---
task: zone-toggle
timestamp_utc: 2025-11-24T14:37:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create zone `active` migration (remote-first plan).
- [x] Update supabase types to include zone.active.

## Core

- [x] Extend zone API (list/create/update) to accept/return `active`.
- [x] Update server table summary to respect inactive zones in capacity.
- [x] Adjust table/zone services to surface active flag.

## UI/UX

- [x] Add zone toggle switch + status badge in `/seating/tables` zone list.
- [x] Indicate inactive zones in filters/table rows; guard table form interactions.
- [ ] Ensure responsive layout + focus states.

## Tests

- [x] Add/adjust API tests for zones active flag.
- [ ] Unit coverage for server summary filtering if present.
- [ ] Manual QA via Chrome DevTools (mobile/desktop, console/a11y).

## Notes

- Assumptions: table creation still allowed for inactive zones but user warned; availability excludes inactive via table.active or zone filter.
- Deviations: none yet.
