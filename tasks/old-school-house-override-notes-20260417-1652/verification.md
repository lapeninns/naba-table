---
task: old-school-house-override-notes
timestamp_utc: 2026-04-17T16:52:21Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Data Verification

Status: Completed.

### Target Restaurant

- `The Old School House`
- `slug = the-old-school-house`
- `id = a120da71-ba6d-446f-a33a-2e78787abcb0`

### Confirmed Change Window

- Temporary note applies on override rows for:
  - `2026-04-17`
  - `2026-04-18`
  - `2026-04-19`
  - `2026-04-20`
  - `2026-04-21`
  - `2026-04-22`
  - `2026-04-23`
- Friday `2026-04-24` is not included.

### Read-After Verification

- [x] All 7 weekly operating-hours rows have `notes = null`.
- [x] Exactly 7 override rows exist for the target dates above.
- [x] Each override row carries:
  - `Open for drinks only for now. Food service is paused while the kitchen offer gets ready.`
- [x] Override rows preserve the corresponding weekly open/close times and `is_closed` state.

## Artifacts

- Before snapshot: `artifacts/before.json`
- After snapshot: `artifacts/after.json`
- Summary: `artifacts/summary.json`

## Known Issues

- None.

## Sign-off

- [x] Engineering
