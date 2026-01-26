---
task: email-status-ui
timestamp_utc: 2026-01-26T10:45:15Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create/extend ops API endpoint for email status
- [x] Create ops service + hook

## Core

- [x] Query bookings within active window and compute email status
- [x] Validate inputs and enforce authz

## UI/UX

- [x] Ops page with filters, table, and pagination
- [x] Loading/empty/error states
- [x] A11y roles, labels, focus management

## Tests

- [x] API route tests
- [ ] Component sanity checks
- [ ] Manual QA (Chrome DevTools MCP)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
