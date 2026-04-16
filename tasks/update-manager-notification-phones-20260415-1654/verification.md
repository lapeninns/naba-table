---
task: update-manager-notification-phones
timestamp_utc: 2026-04-15T16:54:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Automated Verification

- Completed:
  - Read the current production rows for the four target slugs before the change.
  - Normalized the requested values to `E.164` using GB parsing rules:
    - `07886700798` -> `+447886700798`
    - `07886213624` -> `+447886213624`
    - `7476415818` -> `+447476415818`
  - Updated only `restaurants.manager_notification_phone` for the four matching rows.
  - Re-read the same rows after the change and confirmed the persisted values.

## Manual QA — Chrome DevTools (MCP)

- Not applicable. No UI surface changed.

## Artifacts

- Pre/post row snapshots: `artifacts/manager-notification-phone-update.json`

## Known Issues

- None.

## Sign-off

- [x] Engineering
