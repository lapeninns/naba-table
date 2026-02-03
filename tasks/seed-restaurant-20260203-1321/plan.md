---
task: seed-restaurant
timestamp_utc: 2026-02-03T13:22:35Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Seed a New Restaurant

## Objective

We will add a script to seed a single restaurant with placeholder details so the team can amend later.

## Success Criteria

- [ ] One restaurant can be inserted via a script using service role credentials.
- [ ] Inputs are validated and defaults match server expectations.

## Architecture & Components

- `scripts/seed-restaurant.ts`: CLI script that validates inputs and calls the restaurant creation logic.

## Data Flow & API Contracts

- Uses `createRestaurant` from `server/restaurants/create.ts` with service role client.

## UI/UX States

- N/A

## Edge Cases

- Missing service role env vars should fail fast with a clear error.
- Duplicate slug should be auto-resolved by `createRestaurant`.

## Testing Strategy

- Manual run of the script in target environment (staging/production) after env confirmation.

## Rollout

- One-off seed run in the chosen environment; no feature flags.

## DB Change Plan (if applicable)

- N/A
