---
task: zones-migration-seed
timestamp_utc: 2025-11-26T00:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Apply migrations and seed updated zones

## Objective

Apply latest migration(s) to remote Supabase and run the corresponding seed to populate updated tables/zones.

## Success Criteria

- [ ] All pending migrations applied remotely without errors.
- [ ] Seed data for updated zones/tables loaded successfully.
- [ ] Artifacts (CLI logs) stored in task folder.

## Architecture & Components

- Supabase migrations under `supabase/migrations/`.
- Seed script/location to be identified (e.g., `supabase/seed.sql` or custom script).

## Data Flow & API Contracts

- Not applicable; database-only change.

## UI/UX States

- N/A (database ops only).

## Edge Cases

- Seeds may be environment-specific; ensure target is intended remote env.
- Existing data conflicts; seeds should be idempotent if possible.

## Testing Strategy

- Validate migrations applied (Supabase CLI output).
- Verify seed execution output without errors.

## Rollout

- Target environment: current Supabase remote configured via project settings (confirm via CLI output).
- No feature flag; rollback via migration down/backup if required.

## DB Change Plan

- Apply migration(s) remotely with `supabase db push` (already partially done; rerun to ensure clean state).
- Run seed using configured seed command/file once confirmed.
- Capture CLI logs in `artifacts/` and summary in `verification.md`.
- Rollback plan: rely on Supabase backup/PITR; or manual revert migration if available.
