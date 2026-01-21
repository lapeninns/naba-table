---
task: auto-complete-cron-post-emails
timestamp_utc: 2026-01-21T13:53:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auto-complete verification + post-booking email trigger

## Objective

Verify auto-complete cron execution, change it to run **5 minutes after closing** (local time), fix review-email smart scheduling, and provide a safe on-demand trigger for review emails.

## Success Criteria

- [ ] Evidence collected for cron behavior in production (backlog counts and/or cron logs).
- [ ] Auto-complete triggers at restaurant close + 5 minutes (local time) instead of midnight window.
- [ ] Review-request scheduling no longer skips to two days later; uses optimal hours correctly.
- [ ] Manual triggering uses the existing cron endpoint with CRON_SECRET + dryRun/limit.

## Architecture & Components

- **Auto-complete window**: Replace local-midnight window with **closing + 5 minutes** window per restaurant/date:
  - Use `getRestaurantSchedule(restaurantId, { date })` to read `window.closesAt` (from `restaurant_operating_hours`).
  - Convert close time to a local timestamp for the target date and compare to `now`.
  - Only process if `now` is within a small window (e.g., 15 minutes) after closing + 5 minutes.
- **Review email schedule bug**: Fix `adjustToOptimalSendTime` (post-event path) to avoid double-adding days when pushing to next morning.
- **Manual trigger**: Use existing `/api/cron/auto-complete-bookings` endpoint (CRON_SECRET) with `dryRun` and `limit` for controlled runs.

## Data Flow & API Contracts

Endpoint: `GET /api/cron/auto-complete-bookings`

Query params:

```
dryRun=1|true|yes
limit=<int>
windowMinutes=<int>
```

Response: `{ success: true, ...AutoCompleteSummary }`

## UI/UX States

- Not applicable (API-only).

## Edge Cases

- Restaurant has no operating hours/close time for date → skip with reason.
- Closing time crosses midnight (if unsupported) → skip or normalize (confirm behavior).
- Restaurant has no operating hours/close time for date → skip with reason.
- Closing time crosses midnight (unsupported by schedule; treated as closed) → skip.
- Review email duplicates: prevented at queue level by stable `jobId` per booking (no DB flag for sent emails).

## Testing Strategy

- Unit: auto-complete window calculation (closing + 5), and smart-schedule post-event adjustment.
- Integration: API route input validation + enqueue path.

## Rollout

- No feature flag initially; endpoint guarded by ops auth + CRON_SECRET if available.
- Manual verification via dry-run and small batch apply.

## DB Change Plan (if applicable)

- None.
