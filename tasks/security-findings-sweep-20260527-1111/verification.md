# Verification Log

## Scope verified

Opened high-risk task packet for the security findings sweep. Product edits were kept to the current booking/security surfaces and did not touch the pre-existing dirty auto-complete files.

## Route/API identity rows exercised

- `/api/bookings/[id]`: recovery-token GET now returns a redacted guest-safe DTO.
- `/api/bookings/confirm`: confirmation token replay and PII serialization paths covered by regression tests.
- `/api/bookings`: capacity RPC success without a recoverable booking now fails closed instead of using a direct insert fallback.
- Service-only Supabase RPCs: migration assertions cover browser-role revokes and service-role-only grants for the current booking/menu/drink RPCs in scope.

## Commands run

- `git status --short --branch`
  - Outcome: branch is `main...origin/main [behind 5]`; pre-existing dirty files remain `server/jobs/auto-complete-bookings.ts`, `server/ops/booking-lifecycle/actions.ts`, and `tests/server/jobs/auto-complete-bookings.test.ts`.
- `sed -n '1,220p' AGENTS.md`
  - Outcome: root agent contract read.
- `sed -n '1,220p' /Users/amankumarshrestha/.agents/skills/multi-agent-collaboration/SKILL.md`
  - Outcome: multi-agent coordination contract read.
- SDLC and role docs:
  - `docs/sdlc/README.md`
  - `docs/sdlc/native-execution-loop.md`
  - `docs/sdlc/risk-tier-workflow.md`
  - `docs/sdlc/task-harness.md`
  - `docs/sdlc/verification.md`
  - `docs/sdlc/subagents.md`
  - `.agents/*.md`
  - Outcome: high-risk task, verification, and subagent contracts read.
- `rg --files -g 'AGENTS.md' -g '!node_modules' -g '!tasks/**'`
  - Outcome: deeper AGENTS scopes identified before touching scoped files.
- `rg --files -g '*.csv' -g '!node_modules'`
  - Outcome: only `docs/security/deepsec-backlog.csv` found.
- `wc -l docs/security/deepsec-backlog.csv`
  - Outcome: 559 lines; 558 finding rows plus header, not a 35-row local CSV.
- `sed -n '1,240p' docs/security/closure-matrix.md`
  - Outcome: existing closure matrix is root-cause oriented and scanner rerun remains pending.
- `pnpm exec prettier --write ...`
  - Outcome: formatted changed TS/Markdown files.
- `pnpm exec prettier --check ...`
  - Outcome: passed for changed TS/Markdown files. SQL migration was not checked by Prettier because this repo has no inferred SQL parser for `.sql` files.
- `pnpm exec eslint --max-warnings=0 'src/app/api/bookings/[id]/route.ts' 'src/app/api/bookings/route.ts' tests/server/public-booking-manage-token.test.ts tests/server/bookings-confirm-route.test.ts tests/server/public-bookings-route.test.ts tests/server/service-only-rpc-privileges.test.ts`
  - Outcome: passed.
- `pnpm exec vitest run tests/server/public-booking-manage-token.test.ts tests/server/bookings-confirm-route.test.ts tests/server/service-only-rpc-privileges.test.ts tests/server/public-bookings-route.test.ts`
  - Outcome: passed, 4 files and 17 tests.
- `SECRET_SCAN_ALLOW_BUILT_IN_ONLY=true pnpm run secret:scan`
  - Outcome: passed; no potential secrets found. `gitleaks` and `trufflehog` were not installed, so the repo-local built-in fallback was explicitly accepted.
- `pnpm run security:guard:service-role`
  - Outcome: passed; 7 existing exceptions and 0 new violations.
- `git diff --check`
  - Outcome: passed.
- `pnpm run security:regression`
  - Outcome: passed, 26 files and 183 tests.
- `pnpm run typecheck`
  - Outcome: passed.
- `pnpm validate:env`
  - Outcome: passed for schema `development`, `NODE_ENV=development`, `APP_ENV=staging`, `VERCEL_ENV=unset`.
- `pnpm exec tsx -e "...dotenv .env.local env summary..."`
  - Outcome: `.env.local` reports `APP_ENV=staging`, `DB_TARGET_ENV=staging`, and `VERCEL_ENV=unset`; Supabase project ref derived from public URL is `ndxmivcrehsacuerwxtm`.
- `pnpm run lint`
  - Outcome: passed with 5 existing warnings and shadcn advisory inventory only; no blocking lint errors.
- `pnpm exec supabase --version`
  - Outcome: failed because the Supabase CLI is not installed in this checkout.
- `node -e "...print package scripts containing supabase/migration/db/sql..."`
  - Outcome: found `supabase:apply-order:staging:dry`, but it is wired with the placeholder `SUPABASE_DB_URL=YOUR_STAGING_DB_URL`.
- `sed -n '1,260p' scripts/apply_supabase_order.sh`, `sed -n '1,260p' scripts/ordered_apply.sh`, and `sed -n '1,240p' scripts/db/safe-run.ts`
  - Outcome: all three package-referenced helper paths are missing from this checkout.
- `sed -n '1,280p' scripts/apply-sql-file.ts`
  - Outcome: available SQL apply helper has exact project-ref and production-safety guards, but no dry-run mode; running it would be a remote mutation.
- `pnpm exec tsx <<'JS' ... direct staging DB dry-run via SUPABASE_DB_URL ... JS`
  - Outcome: did not run migration SQL; connection setup failed at DNS resolution for `db.ndxmivcrehsacuerwxtm.supabase.co`.
- `pnpm exec tsx <<'JS' ... staging pooler dry-run via supabase/.temp/pooler-url ... JS`
  - Outcome: did not run migration SQL; TLS verification failed because the local environment has no Supabase database CA certificate configured. TLS verification was not bypassed.
- `pnpm exec tsx <<'JS' ... Supabase Management API query probe ... JS`
  - Outcome: passed; `POST /v1/projects/ndxmivcrehsacuerwxtm/database/query` accepted a harmless transaction rollback probe.
- `pnpm exec tsx <<'JS' ... Supabase Management API transactional migration dry-run ... JS`
  - Outcome: passed. The migration SQL ran inside a transaction against staging project `ndxmivcrehsacuerwxtm`, asserted all five RPCs existed, asserted `anon` and `authenticated` lacked `EXECUTE`, asserted `service_role` retained `EXECUTE`, and rolled back.

## Supabase validation

- Local env validation passed and points at staging (`APP_ENV=staging`, `DB_TARGET_ENV=staging`, public project ref `ndxmivcrehsacuerwxtm`).
- Direct Postgres dry-run could not be completed without the project CA certificate; TLS verification was not disabled.
- Staging dry-run was completed through the Supabase Management API query endpoint using a transaction plus rollback. No production apply was attempted.
- Staging apply and production apply remain rollout actions after review/approval.

## Scanner closure

- No local command was found that reruns the original Codex Security/deepsec scanner profile.
- Available local scripts can rebuild `docs/security/deepsec-backlog.csv` from existing `.deepsec/findings`, but that is not a scanner rerun.
- Scanner findings remain locally evidenced only; closure still requires rerunning the same scanner profile or attaching an explicit not-rerun risk acceptance.
- Dedicated scanner not-rerun gap: `scanner-not-rerun-gap.md`.

## External actions still required

- Rotate and document any historically exposed Supabase DB credentials.
- Rotate and document affected seeded/test/staff account credentials where exposure or production/staging target use cannot be disproven.
- Apply the new RPC privilege migration on staging first, then production only after staging apply evidence is attached.
- Rerun the Codex Security/deepsec scanner profile or attach a clear not-rerun closure gap.

The operational steps and evidence requirements are captured in `external-closure-runbook.md`. The scanner gap is captured in `scanner-not-rerun-gap.md`.
