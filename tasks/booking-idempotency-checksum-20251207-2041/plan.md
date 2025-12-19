---
task: booking-idempotency-checksum
timestamp_utc: 2025-12-07T20:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Add payload_checksum column

## Objective

Restore `confirm_hold_assignment_tx` on staging by adding the missing `payload_checksum` column to `public.booking_assignment_idempotency`.

## Success Criteria

- Column exists in staging schema (`\d+ booking_assignment_idempotency` shows `payload_checksum text`).
- Inline/auto assign calls no longer error on missing column.

## Steps

- Connect to staging Postgres using service role credentials from `.env.local`.
- Capture pre-change schema description for `booking_assignment_idempotency`.
- `ALTER TABLE public.booking_assignment_idempotency ADD COLUMN IF NOT EXISTS payload_checksum text;`
- Capture post-change schema description.
- Document verification; no app code changes expected.

## Rollback

- `ALTER TABLE public.booking_assignment_idempotency DROP COLUMN IF EXISTS payload_checksum;` (not executing unless needed).

## Testing

- Manual: re-run booking auto-assign to confirm no missing-column error (out-of-band after DB change).
- Automated tests not run in this hotfix window.
