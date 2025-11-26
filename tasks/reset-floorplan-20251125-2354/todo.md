---
task: reset-floorplan
timestamp_utc: 2025-11-25T23:54:26Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Locate source of truth for zones/tables (DB, seeds, JSON configs).
- [ ] Confirm target environment for data wipe.

## Core

- [ ] Remove/clear existing zones and tables per approved method.
- [ ] Create Main Dining 1 with Inside/Outside tables as specified.
- [ ] Create Main Dining 2 tables as specified.
- [ ] Create Bar tables and flag as drinks-only.

## UI/UX

- [ ] Verify counts and labels appear correctly in booking UI.
- [ ] Ensure any state/URL integration still functions.

## Tests

- [ ] Update/ add tests or fixtures reflecting new inventory.
- [ ] Run relevant test suite.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Target environment? Backup requirements?
