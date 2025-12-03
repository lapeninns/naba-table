# Implementation Checklist

## Setup

- [x] Obtain staging Supabase URL, anon key, service role key, and project ref (store only in `.env.local`).
- [x] Update local `.env.local` to point to staging (`APP_ENV=staging`, `NODE_ENV=development`, `NEXT_PUBLIC_SUPABASE_URL=<staging>`, etc.).
- [x] Document deploy-preview expectation: `APP_ENV=staging`, `NODE_ENV=production`, staging keys via host secrets.

## Core

- [x] Run `pnpm validate:env` with staging values (no overrides).
- [x] Run `pnpm lint` as fast smoke (warnings acknowledged; pre-existing cleanup task).
- [x] Add `scripts/check-staging-supabase.ts` and use it to perform a read-only Supabase smoke test.
- [x] Attempt `supabase gen types ...` against project `mqtchcaavsucsdjskptc`; commit diff or capture blocker if credentials missing.
- [x] Decide on magic-link staging hardening (no staging-only GET surface identified; no code change required now).

## UI/UX

- [ ] N/A (infrastructure)

## Tests & Docs

- [x] Add staging snippet (no secrets) to README and/or `.env.example`, reiterating remote-only Supabase usage.
- [x] Update `docs/environments.md` to clarify APP_ENV expectations.
- [x] Record lint/env/smoke/typegen evidence in `verification.md` (include artifacts if produced).

## Notes

- Assumptions: Staging project already provisioned; no schema changes required
- Deviations: None yet

## Batched Questions

- Provide staging credentials via secure channel (URL, anon key, service role key)?
- Should we also disable magic-link read access in staging while switching? (product/ops decision)
