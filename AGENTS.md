---
agents_version: 1.0.0
last_reviewed: 2026-09-05
scope: repository
---

# Nabatable agent guide

Nabatable is a pnpm workspace containing one Next.js application and four Cloudflare Workers (three on the customer path, one operational control plane). Read this file before planning or editing. Keep changes scoped, test-first, and safe for a multi-tenant hospitality platform.

## Core commands

- Install: `corepack enable && pnpm install --frozen-lockfile`
- Full validation: `pnpm verify`
- Lint: `pnpm lint`
- Type check: `pnpm typecheck`
- Unit and integration tests: `pnpm test`
- Coverage gate: `pnpm test:coverage`
- Production build: `pnpm build`
- All workspace apps: `pnpm verify:workspaces`
- Formatting: `pnpm format:check`
- Security regression pack: `pnpm security:regression`
- Browser smoke: `pnpm exec playwright test tests/e2e/guest-booking.spec.ts`

Run the narrowest relevant test while iterating, then `pnpm verify` before handoff. A fix is not complete without executable evidence.

### CI/CD commands (local-first CI, see `docs/ci/local-first-ci.md`)

- Profiles and contracts: `pnpm ci:profile pr --json`, `pnpm ci:contracts:validate`
- Mac controller (macOS only, needs `node:sqlite`): `pnpm ci:controller --check-config`, `pnpm ci:controller --once`
- Executor plan for one tuple: `pnpm ci:executor --request @tuple.json --dry-run`
- Release gate bridge (hosted): `pnpm ci:gate`
- Database promotion safety: `pnpm db:plan-remote`, `pnpm db:sql-regression`, `pnpm db:check-migration-immutability`, `pnpm db:backup`, `pnpm db:restore-verify`
- Staging separation and deploys: `pnpm deploy:validate-separation --env staging`, `pnpm deploy:staging-lock`, `pnpm deploy:vercel:prebuilt --env staging`, `pnpm deploy:vercel:promote`, `pnpm deploy:workers --env staging --worker <name>`, `pnpm e2e:staging`
- Release evidence: `pnpm release:manifest`, `pnpm release:sbom`
- Operations and recovery: `pnpm ops:verify`, `pnpm ops:slo-evidence`, `pnpm recovery:drill`, `pnpm recovery:evidence:check`

Every one of these fails closed on missing, stale or placeholder (`REPLACE_ME_*`) inputs; none of them may be run against production or staging with credentials from a developer machine.

## Applications

| App                 | Source                              | Local command                                      |
| ------------------- | ----------------------------------- | -------------------------------------------------- |
| Web and API         | `src/**`, `server/**`, `lib/**`     | `pnpm dev`                                         |
| Booking short links | `cloudflare/booking-short-links/**` | `pnpm --filter @nabatable/booking-short-links dev` |
| Email queue gateway | `cloudflare/email-queue-gateway/**` | `pnpm --filter @nabatable/email-queue-gateway dev` |
| SMS summary gateway | `cloudflare/sms-summary-gateway/**` | `pnpm --filter @nabatable/sms-summary-gateway dev` |
| Operational control | `cloudflare/operational-control/**` | `pnpm --filter @nabatable/operational-control dev` |

Operational control is the CI/monitoring control plane (GitHub webhooks, release-gate dispatch, controller heartbeats, readiness probes, incidents); it carries no guest traffic and must not import from another Worker. The public site and ops app share the Next.js deployment. Host and route separation is enforced in `src/proxy.ts`; changes there are high risk. Worker bindings and local ports are documented in `.factory/services.yaml`.

## Non-negotiables

- Use TypeScript strict mode. Do not add `any`, `@ts-ignore`, disabled checks, or fake passing scripts.
- Follow red → green → refactor for behavior changes. Put Vitest tests under `tests/**`; browser journeys live under `tests/e2e/**`.
- Keep tenant data scoped by `restaurant_id`. Service-role clients bypass RLS and must stay server-only.
- Capacity, holds, booking lifecycle transitions, and tenant isolation are database invariants. Do not replace security-definer RPCs with client-side read/modify/write logic.
- Treat request bodies, provider payloads, menu files, and query parameters as untrusted. Validate at the boundary and return safe errors.
- Never log guest names, email addresses, phone numbers, tokens, authorization headers, or provider secrets. Use `lib/logger.ts` and structured context.
- Never commit `.env*` values, credentials, generated coverage, build output, or local Wrangler state.
- Supabase operations are remote-only and staging-first. Use `pnpm db:*`; never run raw production migrations or destructive resets.
- UI work uses the shared shadcn layer in `components/ui/**` and requires browser proof on a shipped route.

### CI/CD non-negotiables

- No production or staging credentials on the local CI Mac or in any local checkout. The `nabatable-ci` login Keychain holds only the `nabatable-local-ci` App key, the write-only R2 evidence token and the heartbeat token; jobs run in disposable VMs with a sanitized `test-*` environment.
- Forks never run locally. The trust policy (`config/ci/trust-policy.json`) rejects any head repository other than the trusted repository id before fetching anything; fork PRs get the secret-less `Fork profile` workflow only.
- `Release gate` is the only authority that turns CI evidence into a merge or deploy decision. It runs from protected `main`, refuses on the first mismatch (repository id, App id, installation id, workflow id, SHA tuple, policy version, image digest, missing or stale evidence), and is never overridden by editing policy or disabling a check.
- Applied migrations are immutable (`config/db/migration-checksums.json`); `pnpm db:plan-remote` must pass before `pnpm db:migrate`, and `pnpm deploy:validate-separation --env staging` must pass before any staging deploy.
- Hosted workflows run Node 22 (`activeRuntime`); Node 24 is the `candidateRuntime` until qualified. Do not flip `engines` or workflow `node-version` outside a reviewed qualification change.

## Architecture and data flow

- Routes and React Server Components: `src/app/**`
- Shared UI: `components/**`, `src/components/**`
- Domain and provider logic: `server/**`
- Cross-cutting libraries, security, and logging: `lib/**`
- Database history: `supabase/migrations/**`
- Cloudflare services: `cloudflare/*/**`
- Operational and security scripts: `scripts/**`

Booking writes flow through route authorization, validated domain logic, and database RPCs. Provider webhooks verify signatures before mutation. Queue consumers must be idempotent and distinguish retryable from terminal failures.

## Change discipline

1. Inspect the live implementation and closest tests before proposing a change.
2. Add or identify a failing test for the required behavior.
3. Make the smallest production change that passes it.
4. Refactor only while green; avoid speculative abstractions.
5. Run lint, type check, relevant tests, coverage, and build in proportion to risk.
6. Report exactly what was executed and what remains externally unverified.

Do not broaden a bug fix into cleanup, rewrite unrelated user changes, or claim production readiness from mocks alone.

## Pull requests and releases

- Branches use a descriptive prefix such as `codex/`, `fix/`, or `feat/`; never force-push `main`.
- PRs must describe intent, risk, test evidence, observability impact, and rollback.
- Keep release notes in `CHANGELOG.md`; Release Please owns release PRs and tags.
- Required checks (`Release gate`, `Local CI / pr`, the compatibility check names, `Service-role route authorization`, `CodeQL JavaScript and TypeScript`) are published by the release gate and the trusted hosted lanes; the list lives in `docs/ci/release-gate.md`. Repository administrators must enforce them with branch protection when the GitHub plan supports it.

## Source-of-truth documentation

- Setup and environment safety: `README.md`, `docs/environments.md`
- Security boundaries: `docs/security.md`
- Booking and business rules: `docs/BUSINESS_LOGIC.md`
- Routes: `docs/current-routes.md`
- Database baseline: `docs/db/supabase-baseline-migrations.md`
- Operational runbooks: `docs/ops/**`, `docs/email/deliverability-runbook.md`
- Local-first CI/CD: `docs/ci/local-first-ci.md`, `docs/ci/release-gate.md`, `docs/ci/governance.md`
- Local CI runner (Mac, Lima, Docker): `docs/runbooks/local-ci.md`, `infra/local-ci/README.md`, `scripts/ci/controller/README.md`
- Staging separation, deploy scripts, provenance: `docs/runbooks/staging-release.md`
- Database promotion safety: `docs/DATABASE_MIGRATIONS.md`
- Monitoring, incidents, SLO evidence: `docs/runbooks/monitoring.md`, `docs/observability.md`
- Backup and recovery: `docs/runbooks/recovery.md`
- Operational control Worker: `cloudflare/operational-control/README.md`

Update this guide in the same PR when commands, app boundaries, or safety rules change. Run `pnpm agents:validate` to verify its links and documented scripts.
