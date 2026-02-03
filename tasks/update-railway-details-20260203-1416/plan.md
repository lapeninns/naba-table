---
task: update-railway-details
timestamp_utc: 2026-02-03T14:17:04Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Update Railway Pub Details

## Objective

Update The Railway Pub details in production with provided address, phone, and URLs where supported.

## Success Criteria

- [ ] Restaurant row updated with new name, address, phone, and review URL.

## Architecture & Components

- One-off script `scripts/update-railway-details.ts`.

## Data Flow & API Contracts

- Use service role client to update `restaurants` by id/slug.

## UI/UX States

- N/A

## Edge Cases

- Restaurant not found in production.

## Testing Strategy

- Read back updated row after update.

## Rollout

- One-off execution in production.

## DB Change Plan (if applicable)

- N/A
