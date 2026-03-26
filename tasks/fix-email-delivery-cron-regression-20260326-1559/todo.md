---
task: fix-email-delivery-cron-regression
timestamp_utc: 2026-03-26T15:59:46Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm canonical Resend + Cloudflare delivery path
- [x] Confirm regression cause from current source and git history

## Core

- [x] Restore `/api/cron/process-emails` schedule in `vercel.json`
- [x] Add regression coverage for required cron routes

## UI/UX

- [x] No UI changes planned

## Tests

- [x] Focused Vitest test for Vercel cron config
- [x] Lint touched files

## Notes

- Assumptions:
  - Vercel cron remains the intended production trigger for email queue draining.
- Deviations:
  - None yet.

## Batched Questions

- None.
