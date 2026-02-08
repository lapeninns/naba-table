---
task: fix-build-typecheck
timestamp_utc: 2026-02-08T01:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix build/typecheck failures

## Objective

Restore `pnpm run build` and `tsc --noEmit` to green by aligning Supabase schema + generated types (staging-linked) and fixing remaining TypeScript issues in scripts/server/routes.

## Success Criteria

- [ ] `./node_modules/.bin/tsc --noEmit` passes.
- [ ] `pnpm run build` passes.

## Approach

1. Validate migrations directory invariants.
2. Baseline/apply pending migrations to linked staging (remote-only).
   - Note: if staging has migration history without the underlying objects (schema drift), add a baseline-safe “ensure” migration and apply follow-up migrations to restore missing primitives.
3. Regenerate `types/supabase.ts` from linked staging.
4. Patch `apply_booking_state_transition` nullability in generated types with an idempotent script.
5. Fix remaining TS errors:
   - omit optional RPC args instead of passing `null`
   - remove `zones.area_type` usage from seed script
   - fix audit JSON types to Supabase `Json`
   - normalize restaurant grace minutes with a shared constant
   - remove dependency on missing `current_bookings` view; keep `get_guest_bookings` as best-effort untyped call

## Rollout

- This is a build correctness fix; no feature flags required.
- Supabase mutations are staging-only in this task.
