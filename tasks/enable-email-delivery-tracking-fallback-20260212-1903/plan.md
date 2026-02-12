---
task: enable-email-delivery-tracking-fallback
timestamp_utc: 2026-02-12T19:04:40Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Email Delivery Feed Fallback

## Objective

Enable ops delivery tracking feed in environments where RPC functions are missing or out-of-sync, without weakening error handling for real storage outages.

## Success Criteria

- [ ] Ops feed endpoint returns attempts via fallback when RPC is unavailable.
- [ ] UI no longer hits DELIVERY_LOG_UNAVAILABLE for RPC-only outages.
- [ ] Storage-unavailable states still return 503.

## Architecture & Components

- Update server/emails/email-delivery-log.ts:
  - keep RPC-first behavior;
  - on unavailable RPC error, execute direct query fallback against email_delivery_log;
  - group attempts by message_id and lower(recipient_email);
  - hydrate booking summary fields for page rows.

## Testing Strategy

- Lint changed file.
- Run existing email-delivery lib tests as regression smoke.
- Record any repository-wide typecheck blockers as pre-existing issues.
