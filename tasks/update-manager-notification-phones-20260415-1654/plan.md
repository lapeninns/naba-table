---
task: update-manager-notification-phones
timestamp_utc: 2026-04-15T16:54:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Update Manager Notification Phones

## Objective

We will update the production manager SMS destination numbers for the requested pubs so that daily booking summaries route to the correct managers.

## Success Criteria

- [ ] Railway Pub and White Horse Pub store `+447886700798`.
- [ ] Old Crown Girton stores `+447886213624`.
- [ ] Corner House Pub stores `+447476415818`.
- [ ] `manager_daily_summary_enabled` remains `true` for all affected active venues.

## Architecture & Components

- Production Supabase `restaurants` rows: source of truth for manager SMS routing.
- Repo validation rules: used to normalize and confirm phone format before write.

## Data Flow & API Contracts

- Read current production rows by slug.
- Normalize requested numbers to `E.164`.
- Update `manager_notification_phone` on matching restaurant rows.
- Re-read the same rows to verify stored values.

## UI/UX States

- No UI changes.

## Edge Cases

- Reject invalid phone normalization before any write.
- Do not touch inactive venues or unrelated restaurants.
- Do not alter any field other than `manager_notification_phone`.

## Testing Strategy

- Automated proof only:
  - pre-update read of affected production rows
  - normalization proof for requested numbers
  - post-update read of affected production rows

## Rollout

- Direct production data update with immediate verification.
- No feature flag required.
- Rollback: restore the previous shared number captured during the pre-update read if needed.

## DB Change Plan (if applicable)

- Target envs: production only
- Backup reference: row-level rollback via captured pre-update values
- Dry-run evidence: pre-update read in `artifacts/`
- Rollback plan: update the same four rows back to their prior `manager_notification_phone`
