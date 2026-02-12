---
task: seed-staging-bookings
timestamp_utc: 2026-02-05T16:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Seed 50 Staging Bookings

## Objective

We will insert 50 valid bookings into staging so that QA and demo flows have realistic data.

## Success Criteria

- [ ] Exactly 50 new bookings inserted into staging.
- [ ] All inserts succeed with valid foreign keys and required fields.
- [ ] Bookings are tagged for cleanup (reference prefix).
- [ ] Operation is traceable (command/log recorded in task artifacts).

## Architecture & Components

- Script: `scripts/generate-bookings-safe.ts` (Supabase service role via `.env.local`).
- Optional validation: `scripts/check-staging-supabase.ts`.

## Data Flow & API Contracts

- Direct SQL insert via secure DB connection for `customers`, `bookings`, `booking_table_assignments`.

## UI/UX States

- N/A (data operation).

## Edge Cases

- Missing/invalid staging credentials.
- Restaurant without active tables.
- Unique constraints on customer phone/email.
- Staging DB hostname unresolved (requires correct DB host/URL).

## Testing Strategy

- Manual verification: query count of new bookings after run.

## Rollout

- Run once against staging only; no production changes.

## DB Change Plan (if applicable)

- N/A (data insert only, no schema change).
