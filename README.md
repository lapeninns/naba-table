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
OPS_ENV_BANNER="Preview: prod read replica"
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` stays on the primary production project URL so auth, cookies, and browser-facing Supabase flows remain canonical.
- The server service-role client reads from `SUPABASE_READ_REPLICA_URL` on non-production targets, which makes write-heavy flows much less likely to succeed.
- Validate the deployment config before relying on it: `pnpm exec tsx scripts/validate-env.ts`
- Verify against the deployed Ops app under `/app/**`. Local `/dev/**` harness routes still use in-memory mocks.
- If you also inject `PRODUCTION_*` marker variables into that same deployment and they equal the runtime values above, `validate-env` will block unless you intentionally choose the explicit override path.

## Database scripts (remote only)

Every database command is guarded by `scripts/db/safe-run.ts` and runs `pnpm validate:env`
before its delegated command.

- Set `DB_TARGET_ENV=staging|production` explicitly; the runner never infers the target.
- `pnpm db:status` — list remote migration status.
- `pnpm db:migrate` or `pnpm db:push` — apply pending migrations.
- `pnpm db:pull` — pull the linked remote schema.
- `pnpm db:check-drift` — compare the linked remote schema with the repository baseline (extended inventory by default; needs `SUPABASE_DB_URL` and the committed `config/db/schema-inventory.json`).
- `pnpm db:plan-remote` — real `supabase db push --dry-run` against the validated linked target (link/host/user/API ref checks, ledger reconciliation, immutability census) in an isolated workdir.
- `pnpm db:sql-regression` — staging-only SQL regression pack with synthetic fixtures inside `BEGIN..ROLLBACK`.
- `pnpm db:check-migration-immutability` — compare applied migrations with `config/db/migration-checksums.json`; `--record --reviewed` appends new files only.
- `pnpm db:backup` — guarded delegation to the encrypted backup runner under the dedicated read-only `DB_BACKUP_ROLE_URL` identity.
- `pnpm db:restore-verify` — guarded restore verification into a scratch project only (never staging or production).
- Append `-- --dry-run` to preview the fixed, redacted command plan without running children.
- Production migration apply additionally requires `CONFIRM_PRODUCTION=true`.
- Local reset, seed, full-reset, and wipe workflows are intentionally unsupported.

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

## CI/CD: local-first, hosted gate

Pull requests and `main` are tested by a Mac controller in disposable Lima VMs and gated by a hosted `Release gate` that runs from protected `main` only. The full design (architecture, job mapping, rollout phases, qualification and provisioning checklists) is in [`docs/ci/local-first-ci.md`](docs/ci/local-first-ci.md); the GitHub-side contract is in [`docs/ci/release-gate.md`](docs/ci/release-gate.md) and [`docs/ci/governance.md`](docs/ci/governance.md).

- `pnpm ci:profile pr --json` — print the resolved CI profile (`pr|main|nightly`).
- `pnpm ci:contracts:validate` — validate workflows, job names, profiles and policy version (runs in `Security guards`).
- `pnpm ci:controller --check-config` / `--once` — validate and smoke-test the Mac controller (see `scripts/ci/controller/README.md` and `docs/runbooks/local-ci.md` for the launchd and Keychain assumptions).
- `pnpm ci:executor --request @tuple.json --dry-run` — print the executor plan for one request tuple without running anything.
- `pnpm ci:gate` — release-gate bridge used by `release-gate.yml` and `deploy.yml`.
- Staging and production delivery: `docs/runbooks/staging-release.md`; monitoring: `docs/runbooks/monitoring.md`; backup and recovery: `docs/runbooks/recovery.md`.

## Design-system invariants (CI-enforced)

The UI is a single Radix Luma design system. Four guards keep it from drifting; all
run on every PR (`shadcn-primitives.yml`, and `quality-gates.yml` via `pnpm lint`):

- **One primitive root.** shadcn primitives live only in `components/ui/*`. App code must
  not import `@radix-ui/*` (or other banned UI libs) or render native `<button> <input>
  <form> <select> <textarea> <label> <table> …` outside that root. Enforced by
  `pnpm guard:no-shadcn:ci` — a baseline ratchet (`config/shadcn-primitives-baseline.json`)
  that blocks new violations while tolerating pinned known debt. After clearing debt, re-pin
  with `pnpm guard:no-shadcn:update-baseline`.
- **No cross-root shadowing.** `@/components/*` resolves `components/` before `src/components/`,
  so the same relative path must never exist in both (the shadowed copy silently forks).
  Enforced by `pnpm guard:no-shadow-roots`.
- **Semantic tokens only.** Prefer Luma semantic tokens over ad-hoc palette utilities; new
  exception-level violations are blocked by `pnpm guard:luma:strict` (baseline:
  `config/qa/luma-baseline.json`, re-pin with `pnpm guard:luma:update-baseline`).
- **Headings use the primitive.** Render headings through `<Heading>`
  (`components/ui/typography.tsx`), not raw `text-2xl`/`text-3xl`/… utilities. `pnpm
guard:typography-scale` ratchets raw heading-scale usage outside `components/ui`
  (baseline: `config/qa/typography-scale-baseline.json`; re-pin after clearing debt with
  `pnpm guard:typography-scale:update-baseline`).

## Security notes

- Never commit `.env*`; templates only (`.env.example`, `.env.local.example`).
- Supabase is remote only; do not run local migrations against production.

## Docs index

- `docs/technical/` — product and integration design notes.
- `docs/environments.md` — environment profiles and safety flags.
- `docs/ci/local-first-ci.md` — local-first CI/CD architecture, rollout and provisioning.
- `docs/runbooks/` — local CI runner, staging release, monitoring and recovery runbooks.
- Email Delivery dev/test validation fixtures:
  - Retry flow fixture: `/email-delivery?fixture=retry-actions`
  - Forced retry failure: `/email-delivery?fixture=retry-actions&simulateRetryMutationError=1`
  - Queue loading fixture: `/email-delivery?tab=queue&queueFixture=loading`
- Legacy docs were removed during cleanup; add new runbooks in `docs/` as they are produced.
