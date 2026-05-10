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

### Public vs server-only env

`NEXT_PUBLIC_*` variables are bundled into browser code and must be treated as public configuration only. The env validator blocks public variable names containing `SERVICE_ROLE`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, or `DATABASE_URL` unless the exact name is reviewed and allowlisted in `config/env.schema.ts`.

Server-only credentials must use non-public names such as `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CRON_SECRET`, or provider-specific secret names. Never create aliases like `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`; builds and deploy validation must fail when those names are present.

### Vercel preview with production-shaped data (read-only)

Use this only when you want a hosted staging/preview deployment to read realistic production data without deliberately turning that deployment into a writable second production app.

Set these environment variables on the target Vercel environment:

```bash
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://<your-production-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
SUPABASE_READ_REPLICA_URL=https://<your-production-read-replica>.supabase.co
FEATURE_SERVICE_CLIENT_USE_READ_REPLICA=true
OPS_ENV_BANNER="Preview: prod read replica"
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` stays on the primary production project URL so auth, cookies, and browser-facing Supabase flows remain canonical.
- The server service-role client can read from `SUPABASE_READ_REPLICA_URL`, which makes write-heavy flows much less likely to succeed.
- Validate the deployment config before relying on it: `pnpm exec tsx scripts/validate-env.ts`
- Verify against the deployed Ops app under `/app/**`. Local `/dev/**` harness routes still use in-memory mocks.
- If you also inject `PRODUCTION_*` marker variables into that same deployment and they equal the runtime values above, `validate-env` will block unless you intentionally choose the explicit override path.

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

Production-oriented scripts must fail closed:

- DB clients use TLS certificate verification. Set `SUPABASE_DB_CA_CERT`, `SUPABASE_DB_CA_CERT_PATH`, or `NODE_EXTRA_CA_CERTS` only when a custom CA bundle is needed.
- Project-ref checks must parse the Supabase DB host/user or API host exactly; substring matches are not acceptable.
- Mutating runs default to dry-run and require explicit confirmation. Destructive production runs also require a break-glass confirmation.
- Restaurant-scoped scripts must require a target restaurant identifier before applying.

Menu import threat model: menu source files are untrusted content. Import scripts may parse object literals or JSON, but they must not execute source JavaScript in a process that has service-role or DB credentials loaded.

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

- `docs/sdlc/README.md` — Nabatable SDLC operating system overview.
- `docs/sdlc/risk-tier-workflow.md` — low/medium/high process model.
- `docs/sdlc/task-harness.md` — task-folder artifact structure.
- `docs/sdlc/verification.md` — verification matrix and evidence expectations.
- `docs/sdlc/subagents.md` — planner/implementer/reviewer/UI-QA operating model.
- `docs/environments.md` — environment profiles and safety flags.
- Email Delivery dev/test validation fixtures:
  - Retry flow fixture: `/email-delivery?fixture=retry-actions`
  - Forced retry failure: `/email-delivery?fixture=retry-actions&simulateRetryMutationError=1`
  - Queue loading fixture: `/email-delivery?tab=queue&queueFixture=loading`
- Legacy docs were removed during cleanup; add new runbooks in `docs/` as they are produced.
