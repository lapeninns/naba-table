---
task: manage-email-link
timestamp_utc: 2025-12-03T15:50:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and docs

## Core

- [x] Update booking email base URL to prefer site origin over app/localhost
- [x] Trim trailing slash to avoid double-slash URLs

## Tests

- [ ] Decide on / run quick validation (manual reasoning or unit check)

## Notes

- Assumptions: Guest manage links should use public site domain; app domain may remain localhost for ops.
- Deviations: No feature flag; minimal scope change.
