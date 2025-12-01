---
task: restaurant-ops-qa
timestamp_utc: 2025-11-30T23:41:24Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant Ops Dashboard QA

## Requirements

- Functional: identify non-happy-path bugs and UX/perf issues across /dashboard, /bookings, /walk-in, /seating, /customers, /settings.
- Non-functional: mobile/tablet usability, accessibility, perf under throttling/offline.

## Existing Patterns & Reuse

- N/A (external SaaS app); will reuse Chrome DevTools MCP for QA as required.

## External Resources

- app.nabatable.com — target app.

## Constraints & Risks

- Third-party app; read-only QA only.
- Credentials provided by requester.

## Open Questions (owner, due)

- None captured yet.

## Recommended Direction (with rationale)

- Execute exploratory QA using Chrome DevTools with device/network emulation; document issues with priority.
