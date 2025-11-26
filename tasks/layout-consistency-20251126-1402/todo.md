---
task: layout-consistency
timestamp_utc: 2025-11-26T14:02:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and docs.

## Core

- [x] Inventory settings pages/sections for container widths (settings shell uses `max-w-6xl`; team page was `max-w-4xl`).
- [x] Standardize on `max-w-6xl` across restaurant settings pages/components (Team now uses settings shell).
- [x] Move Teams nav item into restaurant settings navigation group.

## UI/UX

- [ ] Visual check desktop for settings pages after width change.

## Tests

- [x] Run `pnpm run build`.

## Notes

- Assumptions: Width inconsistency mainly within settings; will scope there unless audit reveals broader issues.
- Deviations: None yet.
