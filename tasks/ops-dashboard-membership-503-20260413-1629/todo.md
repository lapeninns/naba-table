---
task: ops-dashboard-membership-503
timestamp_utc: 2026-04-13T16:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Classify transient membership-query upstream failures in the shared team access layer.
- [x] Map transient membership validation failures to a retryable guard error.
- [x] Apply shared access/error handling across ops dashboard routes.

## Tests

- [x] Add summary-route regression test for retryable `503`.
- [x] Run focused lint/typecheck and dashboard-route tests.

## Notes

- Trigger: production logs showed Cloudflare `502 Bad gateway` HTML from the Supabase host during membership validation.
- Desired outcome: stop misreporting those failures as `403 Forbidden`.
