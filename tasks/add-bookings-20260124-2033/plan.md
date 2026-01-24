---
task: add-bookings
timestamp_utc: 2026-01-24T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Add 45 bookings

## Objective

Create 45 test bookings for 2026-01-25 across the day for ops testing.

## Success Criteria

- [ ] 45 new bookings exist for the target restaurant on 2026-01-25.
- [ ] Bookings are clearly marked as test data.

## Architecture & Components

- Data insert only via Supabase MCP SQL.

## Data Flow & API Contracts

- N/A.

## Edge Cases

- Required columns unknown; must inspect schema.

## Testing Strategy

- Query count of bookings for the restaurant on 2026-01-25 after insert.

## Rollout

- Pre-staging only.

## DB Change Plan (if applicable)

- Target env: pre-staging only.
- Rollback: delete inserted bookings by name prefix and date.
