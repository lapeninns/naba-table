---
task: production-hardening
timestamp_utc: 2025-11-21T13:24:24Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Production Hardening – Nab a Table

## Objective

Harden the codebase and delivery pipeline so dev/staging cannot impact production accidentally, secret exposure is stopped, CI enforces minimum quality/security, and documentation/logging reflect the Nab a Table state.

## Success Criteria

- [ ] No tracked `.env*` or secret values in git; rotated secrets configured in all environments.
- [ ] Dev/staging runtime fails fast if pointed at prod Supabase/booking APIs; DB destructive scripts blocked for prod by default.
- [ ] `/api/test/*` inaccessible in prod unless explicitly enabled with token.
- [ ] CI workflow runs lint, typecheck, test, build, secret scan, and `pnpm audit` on PRs; branch protection configured to require checks.
- [ ] Vulnerable deps patched (`tar` ≥ 7.5.2, `prismjs` ≥ 1.30.0 via upstream, `nodemailer` ≥ 7.0.7) and audit passes.
- [ ] Repo clean of node_modules/build artifacts; lint covers main codebase; structured logging replaces hot-path console logs.
- [ ] README/docs updated with current branding, env model, runbook, and active docs index.

## Architecture & Components

- Env/config
  - Centralize env profile detection (`APP_ENV`, `NODE_ENV`, `RESERVE_ENV` if needed) in a config module (e.g., `scripts/config/env.ts` or `lib/env.ts`).
  - Map per-env Supabase URLs/keys and booking API endpoints; guard to block prod resources in non-prod.
- Security gates
  - DB scripts wrappers (in `package.json` or extracted script helpers) to enforce env allowlist + TTY confirmation.
  - Test endpoint middleware/handler guard to check `ENABLE_TEST_ENDPOINTS` + `TEST_ENDPOINT_TOKEN`.
- CI
  - `.github/workflows/ci.yml` running jobs: install/cache, lint, typecheck, test (stub-aware), build, secret-scan, audit, optional migration-drift (stretch).
  - Support scripts: `scripts/check-tests-exist.ts` or similar to avoid false-positive tests.
- Logging
  - New logger utility under `server/logger.ts` (or `lib/logger.ts`) with structured methods and optional redaction.
  - Replace usage in `server/capacity/selector.ts` and `server/capacity/telemetry.ts`.
- Docs
  - `README.md` rewrite; `docs/README.md` index; `docs/environments.md`; runbook section in docs or README; legacy docs flagged.

## Data Flow & API Contracts

- Env guard
  - Inputs: `APP_ENV` (development|staging|production|test), `NODE_ENV`, Supabase URL/key, booking API URL.
  - Behavior: throw with clear message if `APP_ENV`/`NODE_ENV` mismatch or prod resources used in non-prod.
- `/api/test/*`
  - Request headers/query: `x-test-token` or `test_token` query param.
  - Responses: `403` JSON `{ error: 'forbidden' }` when disabled or token mismatch; success path unchanged for enabled + valid token.
- DB scripts
  - Environment variable `DB_TARGET_ENV` default from `APP_ENV`; optional `ALLOW_PROD_DB_WIPE=true` gating; TTY prompt requiring env name echo.

## UI/UX States

- Minimal UI impact. For API responses, ensure consistent JSON error with generic message to avoid leaking config.
- Docs/readme should clearly state states/flags for enabling test endpoints and DB scripts.

## Edge Cases

- Developers running scripts in CI/non-TTY: confirmation bypass allowed only if env allowlist satisfied and explicit override set.
- Missing env vars: initial validation should fail fast with actionable message rather than defaulting to prod URLs.
- Token not set but flag true: should still reject since token required.
- Stubs in tests: ensure CI fails if no real tests present to prevent false greens.
- History rewrite for secret removal: coordinate to avoid diverging clones; consider non-rewrite if unacceptable.

## Testing Strategy

- Unit: env guard functions, DB script guard logic, test-endpoint guard middleware, logger redaction helpers.
- Integration: handler tests for `/api/test/*` with flag/token matrix; script runner tests using spawned process/mocks if feasible.
- Automation: lint/typecheck/build in CI; secret scan and `pnpm audit` thresholds.
- Manual: staging boot after secret rotation; sanity check email/logging flows; Lighthouse/perf (stretch).

## Rollout

- Feature flags: `ENABLE_TEST_ENDPOINTS` default false; `TEST_ENDPOINT_TOKEN` required when true.
- Safety flags: `ALLOW_PROD_DB_WIPE` default false; `DB_TARGET_ENV` explicit for DB scripts.
- CI: enable workflow on PR and main; add branch protection requiring jobs.
- Migration drift (stretch): add `pnpm check:migrations` job after main CI is stable.

## DB Change Plan (if applicable)

- No schema changes planned; any migration drift checker must not touch production DB directly—use Supabase CLI status/text diff only.
- If schema regeneration needed, run against staging first; capture diff in `tasks/.../artifacts/db-diff.txt`; define rollback path (revert migration/pull known-good snapshot).
