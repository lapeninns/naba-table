---
task: party-size-numeric
timestamp_utc: 2025-11-30T12:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Accept numeric party size inputs

## Objective

Allow booking updates to accept party size values that arrive as numeric strings without breaking existing bounds or flows.

## Success Criteria

- [ ] Ops PATCH `/api/ops/bookings/[id]` accepts numeric string `partySize` and returns 200 when other fields are valid.
- [ ] Guest/ops shared PUT `/api/bookings/[id]` accepts numeric string `partySize` while still enforcing existing min/max limits.
- [ ] No change to time/date validation behavior.

## Architecture & Components

- Zod schemas in API route handlers for bookings updates.

## Data Flow & API Contracts

- Request payloads remain the same; `partySize` now coerces to number server-side before validation.

## Edge Cases

- Non-numeric strings still reject (coerce fails -> validation error).
- Values above max or below min continue to reject.

## Testing Strategy

- Manual: simulate PATCH/PUT with `partySize: "5"` and expect success.
- (Optional) Unit: add schema test; likely skipped for speed.

## Rollout

- Direct change; no feature flag.
