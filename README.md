# SajiloReserveX

Modern reservations and capacity management built with Next.js 16 (App Router), React 19, Supabase, and pnpm workspaces.

## Stack

- Next.js 16 (app directory) · React 19 · TypeScript
- Supabase (Postgres, Auth, Storage) — remote only
- Vite/Storybook for the `reserve` package
- Testing: Vitest (targeted security/ops smoke tests)

## Quick start

1. Install deps: `pnpm install`
2. Copy env template: `cp .env.example .env.local` and fill with **non‑production** Supabase/Resend credentials.
3. Run safety check + dev server:
   - `pnpm validate:env` (env guard will block prod creds in non‑prod by default)
   - `pnpm dev`

## Environment model

- `APP_ENV`: `development` | `staging` | `production` | `test` (defaults to `development`)
- Guardrails:
  - If `APP_ENV` ≠ `production`, the safety check fails when Supabase/booking URLs match the provided production values unless explicitly overridden.
  - Set `PRODUCTION_SUPABASE_URL`/`PRODUCTION_SUPABASE_ANON_KEY`/`PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`/`PRODUCTION_BOOKING_API_BASE_URL` for detection.
  - Override (not recommended): `ALLOW_PROD_RESOURCES_IN_NONPROD=true`.
- Test endpoints: `ENABLE_TEST_ENDPOINTS` (default false) + `TEST_ENDPOINT_TOKEN` are required; missing/invalid token returns 403.

## Database scripts (remote only)

Destructive scripts are guarded by `scripts/db/safe-run.ts`.

- `pnpm db:reset` — apply init schema + seeds
- `pnpm db:migrate` — apply init schema/migrations
- `pnpm db:seed-only` — apply seeds only
- `pnpm db:wipe` — drop public schema
- Safety:
  - Requires `SUPABASE_DB_URL`.
  - Blocks `DB_TARGET_ENV=production` unless `ALLOW_PROD_DB_WIPE=true`.
  - Blocks when non‑prod target uses production DB URL unless override set.
  - TTY prompt to type the target env before continuing.

## Scripts

- `pnpm lint` — ESLint (limited scope; expand as follow‑up)
- `pnpm typecheck` — TypeScript
- `pnpm test` — vitest (security/safety suite)
- `pnpm build` — Next.js build
- `pnpm secret:scan` — gitleaks + trufflehog
- `pnpm audit --prod --audit-level=high` — dependency audit

## CI

`.github/workflows/ci.yml` runs lint → typecheck → tests → build, then secret scan and `pnpm audit --prod --audit-level=high`. Branch protection should require these jobs.

## Security notes

- Never commit `.env*`; templates only (`.env.example`, `.env.local.example`).
- Supabase is remote only; do not run local migrations against production.
- Test-only APIs require `ENABLE_TEST_ENDPOINTS=true` **and** `TEST_ENDPOINT_TOKEN` in header `x-test-token` or query `test_token`.

## Docs index

- `docs/environments.md` — environment profiles, safety flags, test-endpoint usage.
- Legacy docs were removed during cleanup; add new runbooks in `docs/` as they are produced.
