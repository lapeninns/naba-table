# Environment Profiles & Safety

## Profiles

- `APP_ENV`: `development` | `staging` | `production` | `test` (defaults to `development`)
- `NODE_ENV` should mirror `APP_ENV` in production (`NODE_ENV=production`).
- `DB_TARGET_ENV` defaults to `APP_ENV` for DB scripts.

## Supabase email (Resend SMTP)

- Supabase dashboard is configured to send auth/transactional emails via Resend SMTP.
- Provider setup (per env):
  - Resend API key name: **Supabase Integration** (create under Resend → API Keys; store secret in the hosting secret manager, not git).
  - Sender name: **Lapen Inns**
  - Sender email: **team@resend.adtechgrow.com**
  - SMTP host/port/user: `smtp.resend.com` / `465` / `resend`
  - SMTP password: use the generated secret from Resend; inject only in Supabase dashboard (not committed).
- In Supabase: go to **Settings → Email** and paste the above values; confirm the integration from the Supabase dashboard as prompted.
- App-side Resend usage remains via `RESEND_API_KEY` + `RESEND_FROM` in `.env.example`; keep those populated for API-based emails.

## Guardrails

- Env validation (`pnpm validate:env`) fails when:
  - `APP_ENV=production` but `NODE_ENV` is not `production`.
  - Non‑prod env uses production Supabase or booking API values matching `PRODUCTION_*` vars.
- Override (not recommended): `ALLOW_PROD_RESOURCES_IN_NONPROD=true`.

## Staging quick start

- Local/dev: set `APP_ENV=staging`, `NODE_ENV=development`, `DB_TARGET_ENV=staging`, and point Supabase URL/keys at the shared staging project.
- Deploy previews / CI smoke: set `APP_ENV=staging`, `NODE_ENV=production`, and inject the same staging Supabase URL + keys via the hosting provider.
- Keep `ALLOW_PROD_RESOURCES_IN_NONPROD=false` so validation blocks accidental production URLs/keys.
- Never commit real keys; populate `.env.local` (git ignored) or managed secrets only.

### Production markers (placeholders in `.env.example`)

- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_ANON_KEY`
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
- `PRODUCTION_BOOKING_API_BASE_URL`

## Database scripts

- Use `pnpm db:reset|migrate|seed-only|wipe|full-reset`.
- Blocks `DB_TARGET_ENV=production` unless `ALLOW_PROD_DB_WIPE=true`.
- Blocks when non‑prod target uses production DB URL (if provided) unless override set.
- Interactive confirmation in TTY: type the target env to continue.

## Checklist for new env files

- Copy `.env.example` → `.env.local`.
- Fill **non-production** Supabase URL/keys and booking API URLs (staging by default).
- Set `APP_ENV=development|staging` for local/staging; `NODE_ENV` should remain `development` for local runs (deploy previews may use `NODE_ENV=production`).

## Secret rotation & history cleanup

> Run these steps inside a scheduled maintenance window. Never paste secrets into task artifacts or git history.

1. **Inventory secrets**
   - Supabase: anon key, service role key, DB password, JWT secret, connection string.
   - Resend: API key(s) per environment.
   - Any other third-party keys referenced in `.env.example`.
2. **Rotate in staging first**
   - Generate new values via provider dashboards.
   - Update staging hosting/CI secrets and `.env.staging`.
   - Run `pnpm validate:env`, smoke tests, and staging health checks.
3. **Promote to production**
   - Set `APP_ENV=production`, `NODE_ENV=production` in hosting provider.
   - Update production secrets and verify health.
4. **Update repo artifacts**
   - Refresh `.env.example` placeholders (never real secrets).
   - Document hashes or metadata in `tasks/<slug>/artifacts/secret-rotation.md`.
5. **Purge leaked secrets from git history**
   - `brew install git-filter-repo` (or use BFG).
   - `git filter-repo --path .env.local --invert-paths` or target individual files containing leaked values.
   - Force-push and notify collaborators to `git fetch --all --prune` + `git reset --hard origin/<branch>`.
6. **Re-run validation**
   - `pnpm validate:env`
   - `pnpm db:status`

If any provider restricts immediate rotation, capture the exception in `tasks/.../todo.md` and schedule a follow-up.
