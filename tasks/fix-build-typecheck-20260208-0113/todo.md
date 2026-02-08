---
task: fix-build-typecheck
timestamp_utc: 2026-02-08T01:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Supabase / Types

- [x] Check migration versions unique (`scripts/supabase/check_migration_versions_unique.sh`)
- [x] `supabase migration list --linked` (capture)
- [x] `supabase db push --linked --dry-run` (capture)
- [x] If pending: `supabase db push --linked --yes` (capture)
- [x] Regenerate types: `supabase gen types --linked --lang typescript --schema public,auth > types/supabase.ts`
- [x] Add patch script: `scripts/supabase/patch-generated-types.ts`
- [x] Run patch script and verify idempotency

## Code Fixes

- [x] `scripts/staging/smoke-email-delivery-rpc.ts` omit optional args
- [x] `server/emails/email-delivery-log.ts` use `undefined` for optional args
- [x] `server/occasions/admin.ts` audit JSON to `Json`, remove stale cast
- [x] Add `lib/restaurants/defaults.ts` and normalize grace minutes in server/routes
- [x] `scripts/seed-railway-from-cornerhouse.ts` remove `area_type`
- [x] `src/app/api/bookings/route.ts` remove `current_bookings` dependency; untyped `get_guest_bookings`

## Verification

- [x] `./node_modules/.bin/tsc --noEmit`
- [x] `pnpm -s run lint` (warnings only)
- [x] `pnpm run build`
