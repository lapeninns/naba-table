---
task: disable-zones-tables
timestamp_utc: 2025-11-24T16:09:41Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Disable zones/tables for bookings

## Objective

Ensure disabled zones or tables cannot receive new bookings (auto or manual), and surface existing bookings on disabled resources for reassignment.

## Success Criteria

- [ ] Auto-assign excludes disabled zones/tables.
- [ ] Manual assignment UI/API rejects disabled targets.
- [ ] Existing bookings tied to disabled resources are detectable for follow-up.

## Architecture & Components

- Backend booking assignment services: filter candidates by `disabled` status.
- Data models: zone and table include `disabled` boolean.
- Manual assignment UI (if present): disable options for disabled resources.
- Reporting: endpoint/query to list bookings on disabled tables/zones.

## Data Flow & API Contracts

- Assignment API: Validate target table/zone not disabled; return error code `RESOURCE_DISABLED` when violated.
- Auto-assign: Candidate query excludes disabled tables/zones.
- Possibly add mutation to toggle `disabled` state (reuse existing if present).

## UI/UX States

- Disabled zones/tables appear visibly disabled and unselectable.
- Error toast/message when attempting assign to disabled target.

## Edge Cases

- Zone disabled while booking in progress → re-validate on submit.
- Table disabled but zone active.
- Booking already on disabled resource → flag in list/report.

## Testing Strategy

- Unit: assignment logic filters disabled resources.
- Integration: API rejects disabled target; auto-assign never returns disabled table.
- (UI if touched) Interaction prevents selection and shows message.

## Rollout

- Feature flag: `feat.reservation.disable-zone-table` (default on once complete).
- Monitoring: errors for `RESOURCE_DISABLED` spikes.
- Kill-switch: revert flag to allow previous behavior.

## DB Change Plan (if applicable)

- Verify if `disabled` fields already exist; if not, add nullable booleans via remote migration (staging → prod) with backups noted.
