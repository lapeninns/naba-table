---
task: email-delivery-status
timestamp_utc: 2026-01-26T12:03:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Email Queue + Delivery Status

## Objective

Enable Ops to see both queue state and actual delivery status for all booking emails.

## Success Criteria

- [ ] Ops page shows Queue + Delivery tabs with filters and pagination.
- [ ] Delivery status reflects Resend events (sent/delivered/bounced/complained/failed).
- [ ] Webhook signature verified via Svix headers.
- [ ] Cleanup cron enforces 180-day retention.

## Architecture & Components

- New table `email_delivery_log` (Supabase).
- Webhook endpoint: `/api/webhooks/resend` (signature verification).
- Extend ops email-status API to join delivery log.
- Update Ops UI to surface delivery timeline (Queue + Delivery).
- Daily cron to purge old delivery logs.

## Data Flow & API Contracts

- On email send: log `sent` event with provider message id.
- Webhook: update log with delivery status.
- Ops API: `view=queue` (jobs) or `view=delivery` (events).

## UI/UX States

- Loading / Empty / Error / Success

## Testing Strategy

- Unit tests for ops API responses.
- Integration test for ops API response.
- Manual DevTools MCP QA for UI.

## DB Change Plan

- Staging → production; expansion → backfill → contraction.
- Attach migration diff to `artifacts/db-diff.txt`.
- Rollback plan: drop new table if unused.
