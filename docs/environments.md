# Environment Profiles & Safety

## Profiles

- `APP_ENV`: `development` | `staging` | `production` | `test` (defaults to `development`)
- `NODE_ENV` should mirror `APP_ENV` in production (`NODE_ENV=production`).
- `DB_TARGET_ENV` defaults to `APP_ENV` for DB scripts.

## Guardrails

- Env validation (`pnpm validate:env`) fails when:
  - `APP_ENV=production` but `NODE_ENV` is not `production`.
  - Non‑prod env uses production Supabase or booking API values matching `PRODUCTION_*` vars.
- Override (not recommended): `ALLOW_PROD_RESOURCES_IN_NONPROD=true`.

### Production markers (placeholders in `.env.example`)

- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_ANON_KEY`
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
- `PRODUCTION_BOOKING_API_BASE_URL`

## Test endpoints (`/api/test/*` and `/api/test-email`)

- Defaults: `ENABLE_TEST_ENDPOINTS=false` in all environments.
- To enable locally/staging:
  - Set `ENABLE_TEST_ENDPOINTS=true`.
  - Set `TEST_ENDPOINT_TOKEN=<random>` and include it as header `x-test-token` or query `test_token`.
- Missing/invalid token or disabled flag returns `403` with a generic response. Production should keep the flag false and omit the token.

## Database scripts

- Use `pnpm db:reset|migrate|seed-only|wipe|full-reset`.
- Blocks `DB_TARGET_ENV=production` unless `ALLOW_PROD_DB_WIPE=true`.
- Blocks when non‑prod target uses production DB URL (if provided) unless override set.
- Interactive confirmation in TTY: type the target env to continue.

## Checklist for new env files

- Copy `.env.example` → `.env.local`.
- Fill **non‑production** Supabase URL/keys and booking API URLs.
- Set `APP_ENV=development|staging` for local/staging; `NODE_ENV` should remain `development` for local runs.
- Keep `ENABLE_TEST_ENDPOINTS=false` unless explicitly testing with a token.
