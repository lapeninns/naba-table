# Nab a Table

Modern reservations and capacity management built with Next.js 16 (App Router), React 19, Supabase, and pnpm workspaces. Parent company: Lapen Inns; platform brand: Nab a Table.

## Stack

- Next.js 16 (app directory) · React 19 · TypeScript
- Supabase (Postgres, Auth, Storage) — remote only
- Vite/Storybook for the `reserve` package

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

### Staging profile quick start (non-prod)

Use this snippet when pointing local/dev or deploy-preview environments at the shared staging Supabase project:

```
APP_ENV=staging
# Local/dev:
NODE_ENV=development
# Deploy previews / CI smoke:
# NODE_ENV=production
DB_TARGET_ENV=staging
NEXT_PUBLIC_SUPABASE_URL=https://<your-staging-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PRODUCTION_SUPABASE_URL=https://<your-prod-project>.supabase.co
PRODUCTION_SUPABASE_ANON_KEY=your_prod_anon_key_here
PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key_here

# Safety: block prod resources unless explicitly allowed
ALLOW_PROD_RESOURCES_IN_NONPROD=false
ALLOW_PROD_DB_WIPE=false
```

> Keep real keys in `.env.local` (git-ignored) and your hosting provider’s secret manager—never commit secrets. For deploy previews, set the same staging values as environment variables with `APP_ENV=staging` + `NODE_ENV=production` so that Supabase always points at staging.

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
- `pnpm build` — Next.js build
- `pnpm secret:scan` — gitleaks + trufflehog
- `pnpm audit --prod --audit-level=high` — dependency audit

## Security notes

- Never commit `.env*`; templates only (`.env.example`, `.env.local.example`).
- Supabase is remote only; do not run local migrations against production.

## Docs index

- `docs/environments.md` — environment profiles and safety flags.
- Legacy docs were removed during cleanup; add new runbooks in `docs/` as they are produced.
