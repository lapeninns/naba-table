---
task: fix-service-gap
timestamp_utc: 2025-12-08T00:42:05Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Service Gap Logic

## Issue

User reported log:
`[capacity][window][fallback] service not found, using fallback service { start: '2025-12-18T16:30:00...`

## Root Cause

`server/capacity/policy.ts` defines:

- Lunch ends at 15:00.
- Dinner starts at 17:00.
- Time 16:30 falls in the gap.

## Resolution

Update `defaultVenuePolicy` to close the gap.
Move Dinner start to 16:00 (4:00 PM) to accommodate early bookings or test cases.

## Plan

1.  Edit `server/capacity/policy.ts`.
2.  Update `dinner.start` to `{ hour: 16, minute: 0 }`.
