---
task: sync-staging-schema-with-prod
timestamp_utc: 2026-02-07T10:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Sync Staging Schema With Production

## Objective

Bring staging schema up to match production schema, and record the change as a canonical migration in the repo.

## Success Criteria

- [x] New staging project exists (separate from existing pre-staging).
- [x] New staging has production `public` schema (schema-only).
- [x] New staging includes restaurant/config data needed to boot the app.
- [x] New staging contains **no** customers/bookings data.

## Approach

1. Create a brand-new staging Supabase project in the same org/region as production.
2. Use Postgres client tools (libpq) to:
   - Dump production `public` schema only and restore into new staging.
   - Dump production config-only data tables and restore into new staging.
3. Verify staging has restaurants/config and **zero** customers/bookings.

## Rollout

- Update app/staging deployment configuration to point to the new project ref `ndxmivcrehsacuerwxtm`.
- After parity is confirmed, follow-up task to enforce migration-only workflow so prod/staging cannot drift again.

## Verification

- CLI outputs saved under `artifacts/`.
- Manual spot-check queries for existence of added tables/columns/functions.
