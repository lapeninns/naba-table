---
task: supabase-staging-migration
timestamp_utc: 2025-12-03T17:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

- [ ] Not applicable (infra change) — no UI deltas to validate.

## Console & Network

- [ ] No console errors (if UI exercised)
- [ ] Supabase network calls succeed against staging

## DOM & Accessibility

- [ ] N/A (no UI change)

## Performance (mobile; 4× CPU; 4G)

- [ ] N/A (no UI change)

## Device Emulation

- [ ] N/A

## Test Outcomes

- [x] `pnpm validate:env` (APP_ENV=staging, DB_TARGET_ENV=staging) — passed using new `scripts/validate-env.ts`.
- [x] `pnpm lint` — completed with existing warnings (`no-explicit-any`, unused consts) in legacy server files; no new errors introduced.
- [x] `pnpm tsx scripts/check-staging-supabase.ts` — verified service-role connectivity; sample restaurant `White Horse Pub` returned.
- [x] `supabase gen types typescript --project-id mqtchcaavsucsdjskptc --schema public > types/supabase.ts` — refreshed type surface from staging (no additional manual edits).
- [ ] Optional staging magic-link hardening: reviewed `src/app/api/auth/*` handlers; no read-only GET surface to secure right now, so no code change (documented below).

## Artifacts

- `types/supabase.ts` — regenerated from staging schema (see repo diff).
- Command logs available in this task’s session history (no separate artifacts needed).

## Known Issues

- [ ] ESLint still reports legacy `any` usage across several `server/*` files — pre-existing debt outside current scope.
- [ ] Magic-link staging guard: no read-only GET path identified beyond Supabase callback, so no change shipped. Revisit if a public viewer endpoint is added.

## Sign-off

- [ ] Engineering
- [ ] QA
