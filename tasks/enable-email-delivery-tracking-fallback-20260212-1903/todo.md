---
task: enable-email-delivery-tracking-fallback
timestamp_utc: 2026-02-12T19:04:40Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Add fallback query flow for list attempts when RPC feed is unavailable.
- [x] Apply range, filter, and pagination behavior in fallback path.
- [x] Keep unavailable error semantics for true log storage failures.
- [x] Emit observability event when fallback path is used.

## Tests

- [x] Lint changed file.
- [x] Run email-delivery lib tests.
- [ ] Full typecheck (blocked by pre-existing unrelated task artifact TS error).

## Notes

- Fallback scan is capped to prevent unbounded reads.
