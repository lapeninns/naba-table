---
task: fix-lint-scripts
timestamp_utc: 2025-12-28T12:07:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix lint failures in scripts

## Objective

We will align the three Node scripts with repo lint rules and security policy by switching to ESM imports and env-based secrets.

## Success Criteria

- [ ] `scripts/debug-restaurants` uses env vars and no `require()`.
- [ ] `scripts/execute-sql` uses env vars and no `require()`.
- [ ] `scripts/generate-bookings-safe` uses env vars and no `require()`.

## Architecture & Components

- `scripts/*.ts` only; reuse existing dotenv + ESM patterns.

## Data Flow & API Contracts

- Supabase client uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- SQL runner uses `SUPABASE_DB_URL` (or `DATABASE_URL`) from env.

## UI/UX States

- N/A.

## Edge Cases

- Missing env vars: script exits with a clear error message.

## Testing Strategy

- Lint only (manual run or lint-staged).

## Rollout

- N/A.

## DB Change Plan (if applicable)

- N/A.
