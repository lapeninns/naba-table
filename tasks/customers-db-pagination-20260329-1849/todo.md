---
task: customers-db-pagination
timestamp_utc: 2026-03-29T18:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Research and contracts

- [x] Review the current in-memory customers rollup path
- [x] Review the old `customer_profiles`-backed pagination path
- [x] Confirm migration-backed RPC is an established repo pattern

## Database

- [x] Add customers guest-history feed RPC migration
- [x] Add customers guest-history summary RPC migration
- [x] Update generated/checked-in Supabase types for the new RPCs

## Server and API

- [x] Replace in-memory customers list path with feed RPC mapping
- [x] Replace in-memory summary path with summary RPC mapping
- [x] Page export through the feed RPC in batches

## Tests and verification

- [x] Add or update tests for server mapping/pagination behavior
- [x] Run targeted vitest
- [x] Run typecheck
- [x] Run targeted lint
- [x] Run Chrome DevTools verification for unchanged UI behavior

## Notes

- Assumptions:
  - SQL RPCs are the lowest-risk way to restore DB-level pagination without reintroducing stale `customer_profiles` semantics.
- Deviations:
  - The new RPC path falls back to the prior in-memory implementation only when the migration is not yet available in the remote schema cache. This is a rollout safeguard and should be removed once the migration is confirmed live everywhere.
  - Migration apply will need to happen remotely after merge; this environment is code-only.
