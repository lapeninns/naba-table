---
task: fix-build-typecheck
timestamp_utc: 2026-02-08T01:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Commands

- `bash scripts/supabase/check_migration_versions_unique.sh`
- `supabase migration list --linked`
- `supabase db push --linked --dry-run`
- `supabase db push --linked --yes` (applied pending migrations to linked staging)
- `supabase gen types --linked --lang typescript --schema public,auth > types/supabase.ts`
- `pnpm -s tsx scripts/supabase/patch-generated-types.ts` (idempotent post-process)
- `./node_modules/.bin/tsc --noEmit`
- `pnpm -s run lint`
- `pnpm run build`

## Outcomes

- Migration versions unique: ✅
- Linked staging migrations applied: ✅
  - Applied: `20260208013000` through `20260208013170` (soft-holds table + RPCs + grants)
- Supabase types regenerated from linked staging: ✅
  - Soft-hold RPCs present in `types/supabase.ts`: ✅
  - `apply_booking_state_transition` nullability patched: ✅
- TypeScript typecheck (`tsc --noEmit`): ✅
- Lint: ✅ (warnings only)
- Next build: ✅

## Artifacts

- `artifacts/check_migration_versions_unique.txt`
- `artifacts/supabase_migration_list.txt`
- `artifacts/supabase_db_push_dry_run.txt`
- `artifacts/supabase_db_push_apply.txt`
- `artifacts/supabase_gen_types.txt`
- `artifacts/patch_generated_types.txt`
