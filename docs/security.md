---
title: Security & Compliance Controls
description: Required security workflows for Nab a Table
---

# Security & Compliance Controls

## Secret rotation

1. Inventory provider keys (Supabase anon/service/DB password, Resend API key, any third-party tokens).
2. Rotate in staging first, verify health, then promote to production.
3. Update hosting + CI secrets plus `.env.example` placeholders. Never commit live values.
4. Scrub prior secrets from git history via `git filter-repo`/BFG and coordinate a force-pull with collaborators.
5. Record the rotation in the provider or incident-management system without copying secrets.

## Migration drift detection

- Link the Supabase CLI to the intended staging project, then run
  `DB_TARGET_ENV=staging pnpm db:check-drift` first.
- The safe runner validates the environment before delegating to
  `supabase db diff --linked --schema public`. Any emitted SQL is treated as drift and exits
  non-zero.
- When drift is detected:
  1. Reconcile the difference in an idempotent migration under `supabase/migrations/`.
  2. Apply the migration through `DB_TARGET_ENV=staging pnpm db:migrate`.
  3. Re-run the guarded staging drift check before promoting the migration.

## Local expectations

- Run `pnpm lint` and `DB_TARGET_ENV=staging pnpm db:check-drift` before opening a database PR;
  the database wrapper runs `pnpm validate:env` before its linked drift command.
- Never bypass CI scans; if you must temporarily suppress a false positive, add the hash/commit to a gitleaks or trufflehog allowlist with justification in the task folder.

## Extended drift inventory

`DB_TARGET_ENV=staging pnpm db:check-drift` now also requires `SUPABASE_DB_URL`: after the public
diff it compares functions, grants, RLS policies, constraints, table RLS flags, role settings and
default privileges against `config/db/schema-inventory.json`. A missing baseline fails closed
(set `DB_DRIFT_SCOPE=public` only for the legacy diff-only behaviour). Applied migrations are
immutable: `pnpm db:check-migration-immutability` refuses any change to a file recorded in
`config/db/migration-checksums.json`, and `pnpm db:plan-remote` must pass before `pnpm db:migrate`.

## Readiness endpoints

`GET /api/ready` (web) and `GET /ready` (every Worker) are bearer-authenticated with
`MONITORING_TOKEN`, compared in constant time (SHA-256 + `timingSafeEqual` on the web,
dependency-free constant-time compare in `cloudflare/shared/readiness.ts`). They fail closed with a
generic `401` when the token is unconfigured, send `cache-control: no-store`, and run only bounded
(<= 2 s) read-only probes: no sends, no GBP publishes, no booking mutations, and no tenant or
provider payloads in the response. `/health` routes are unchanged and unauthenticated.

## Local CI runner isolation

Details: `docs/runbooks/local-ci.md`, `infra/local-ci/network/README.md`,
`scripts/ci/executor/**`. Jobs run in disposable Lima VMs cold-cloned per job from a digest-verified
golden image with no host mounts, no port forwards and no proxy environment. Inside the VM the job
container runs as a non-root uid from `infra/local-ci/operating.json`, `--cap-drop=ALL`,
`no-new-privileges`, the seccomp profile `infra/local-ci/seccomp/ci-job.json`, a read-only root
with `noexec` tmpfs, and a disposable workspace volume only (no host or socket mounts). Egress is
allowed only through the allowlisted guest proxy during phase `prep` (nftables rules in
`infra/local-ci/network/egress.sh`) and is fully closed during phase `test`; an unverifiable phase
switch aborts the job. The job environment is a sanitized allowlist in which every
credential-shaped key must carry a `test-*` dummy. Evidence is redacted before it is digested and
uploaded to R2 with SigV4 from the host; R2 credentials never enter the VM. Secrets exist only in the
`nabatable-ci` login Keychain (App private key, heartbeat token, write-only evidence token); no
production or staging credential is ever present on the CI Mac.

## GitHub Apps and trust policy

Two GitHub Apps carry the CI identities: `nabatable-local-ci` on the Mac (`checks: write`;
`metadata`, `contents`, `pull_requests`, `actions`: read) and `nabatable-ci-dispatch` in the
operational-control Worker (`actions: write`, read otherwise). Private keys never leave the Keychain
or the Worker secret store. `config/ci/trust-policy.json` routes work purely from repository
metadata: a head repository other than the trusted numeric repository id (forks) is rejected before
any fetch, automation identities and unknown actors are routed to hosted CI, and labels, branch
names and titles are never part of the decision. While the policy is unconfigured
(`REPLACE_ME_REPOSITORY_ID`) every pull request is routed to hosted CI.

## Release gate authority

`Release gate` (`pnpm ci:gate`, `release-gate.yml`) is the only component that turns CI evidence
into a merge or deploy decision. It checks out protected `main` only, refuses on the first mismatch
(repository id, App id, installation id, check name, `external_id` tuple key, attempt, policy
version, image digest, controller version, superseded head, stale or missing evidence, wrong
workflow id for hosted lanes or fallback runs) and publishes failures rather than staying silent.
`pnpm ci:contracts:validate` runs in `Security guards` and fails any change that widens the gate's
permissions, checks out a candidate revision, unpins an action, adds path filters to a required
lane, or lets policy drift from `scripts/ci/profiles`.

## Operational control Worker

`cloudflare/operational-control` verifies GitHub webhook signatures with HMAC-SHA256 over the raw
body in constant time, caps bodies at 512 KiB, requires `repository.id` and the local CI App id to
match, de-duplicates delivery ids for 24 h, and never trusts a webhook's success flags: it reads the
check runs, pull request and workflow runs back from the API before dispatching. `workflow_dispatch`
is restricted to the two configured workflow ids on `refs/heads/main`; the hosted fallback is never
auto-dispatched. Heartbeats are a flat allow-listed payload and credential-like keys are rejected.
Evidence written to R2 is redacted with `cloudflare/shared/redaction.ts`, capped at 64 KiB and
expires after 14 days.

## Staging separation

Staging must never inherit a production identity. `pnpm deploy:validate-separation --env staging`
flattens every `env.staging` leaf of all four Workers, the environment descriptors, `vercel.json`
and the process environment, and fails with the dotted field path on any equal identity,
`REPLACE_ME` / `replace-me` placeholder or production host. `deploy:workers` refuses without fresh
(< 24 h, same config digest) separation evidence. Staging Workers deliver nothing:
`DELIVERY_MODE=sink` short-circuits SMS/WhatsApp sends, the staging Vercel project runs
`RESEND_USE_MOCK=true`, and the staging short-links Worker only accepts staging destination hosts.

## Backup credential boundary

Backups run under a dedicated read-only Postgres role (`DB_BACKUP_ROLE_URL`; `postgres`,
`service_role`, admin and pooler identities are refused and the password may not equal the deploy
password). Dumps are encrypted client-side with AES-256-GCM (`BACKUP_ENCRYPTION_KEY`) before they
leave the runner; plaintext never touches disk. The backup bucket is separate from the CI evidence
bucket, `scripts/db/backup/s3.ts` is intentionally not shared with `scripts/ci`, and restore
verification refuses the staging and production project refs unconditionally. Drill evidence is
HMAC-signed and redacted; `pnpm recovery:evidence:check` blocks delivery when a backup is older than
24 h or a successful drill older than 30 days.
