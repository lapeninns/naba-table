---
task: zones-migration-seed
timestamp_utc: 2025-11-26T00:15:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: N/A (DB-only change)

### Console & Network

- [x] No errors during migration/seed execution (final seed rerun succeeded after adjusting seed logic)

### DOM & Accessibility

- N/A

### Performance

- N/A

### Device Emulation

- N/A

## Test Outcomes

- [x] Migration applied successfully (no pending migrations on rerun)
- [x] Seed executed successfully (`pnpm db:seed-only`)

## Notes

- First seed run failed due to new `bar_tables_drinks_only` trigger rejecting lunch bookings on bar tables; updated `supabase/seed.sql` to restrict bar tables to `drinks` bookings.

## Rollback

- Seeds are idempotent; rerun `pnpm db:seed-only` if needed. For data rollback rely on Supabase PITR/backups.

## Artifacts

- Migration: `tasks/zones-migration-seed-20251126-0015/artifacts/db-push-20251126.txt`
- Seed (failed attempt): `tasks/zones-migration-seed-20251126-0015/artifacts/db-seed-20251126-run1.txt`
- Seed (successful): `tasks/zones-migration-seed-20251126-0015/artifacts/db-seed-20251126-run2.txt`

## Known Issues

- None noted yet

## Sign-off

- [ ] Engineering
- [ ] QA
