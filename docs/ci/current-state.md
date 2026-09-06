# CI/CD current state

The other documents in `docs/ci/` and `docs/runbooks/` describe the **intended** CI/CD design. This
page records what is actually running, verified against the GitHub API and this repository on
**2026-09-06**. Where the two disagree, this page is correct.

Update this page whenever a row moves between tables.

## What actually deploys production

**Vercel's Git integration deploys every push to `main` directly to production.** GitHub deployment
records show `vercel[bot]` creating `Production` deployments for recent `main` commits, including the
two `[skip ci]` commits that carried no CI evidence at all. Cloudflare Workers Builds deploys the
three customer-facing Workers on push.

Neither path consults the release gate, an approval, a staging soak, or a smoke test.

> **Treat any commit merged to `main` as immediately live in production.**

`Protected delivery` (`.github/workflows/deploy.yml`) — the evidence-gated, staged, approved pipeline
that `docs/runbooks/staging-release.md` describes — **has never run successfully**. Its last twenty
runs are eleven `startup_failure`, one `skipped`, zero successes.

## What is operating

| Capability                  | State   | Notes                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------- |
| PR and `main` test lanes    | ✅ live | Self-hosted `nabatable` runner; 7 checks, ~0 hosted Actions minutes        |
| `main` branch protection    | ✅ live | Ruleset: PR required, linear history, no force-push, no deletion, 7 checks |
| CI contract validation      | ✅ live | `pnpm ci:contracts:validate` runs inside `Security guards`                 |
| Secret scanning             | ✅ live | gitleaks + trufflehog, SHA-256 pinned, architecture-aware                  |
| Local runner crash recovery | ✅ live | launchd supervisor restarts the VM and the agent                           |
| Vercel production deploy    | ⚠️ live | Automatic and **ungated** — see above                                      |
| Cloudflare Workers deploy   | ⚠️ live | Automatic and **ungated** via Workers Builds                               |

## What is not operating

| Capability                    | State        | Why                                                             |
| ----------------------------- | ------------ | --------------------------------------------------------------- |
| `Protected delivery`          | ❌ never ran | `ubuntu-latest` + exhausted minutes; 0 of 21 secrets configured |
| `Release gate`                | ❌ never ran | `ubuntu-latest`; also `allowedImageDigests` is a `REPLACE_ME`   |
| CodeQL                        | ❌ never ran | `ubuntu-latest` + exhausted minutes                             |
| Hourly operational verifier   | ❌ never ran | `ubuntu-latest`; `Monitoring` environment holds no secrets      |
| Database backup (12-hourly)   | ❌ never ran | `ubuntu-latest`; `Backup` environment holds no secrets          |
| Restore drill                 | ❌ never ran | Also blocked by a placeholder backup bucket (below)             |
| DAST                          | ❌ never ran | `ubuntu-latest`; `DAST_*` variables unset                       |
| External alerting / heartbeat | ❌ not armed | `MONITORING_HEARTBEAT_URL` unset by owner choice                |
| Local-first CI controller     | ❌ not built | Superseded in practice by the stock self-hosted runner          |

**No independent backup of this database has ever been taken, and no restore has ever been timed.**

## Three blockers that are not credentials

1. **Hosted Actions minutes are exhausted.** Every `ubuntu-latest` job fails to start with
   _"The job was not started because recent account payments have failed or your spending limit needs
   to be increased."_ This alone explains every `startup_failure` above. Resolve in
   GitHub → Settings → Billing, or migrate the affected workflows to `[self-hosted, nabatable]`.
2. **`config/recovery/policy.yaml` still reads `bucket: REPLACE_ME_ENCRYPTED_BACKUP_BUCKET`.** Both
   `scripts/db/restore/verify.ts` and `evidence-check.ts` hard-refuse on it, with no environment or
   CLI override, so the restore drill and the production recovery gate cannot run whatever the
   `BACKUP_S3_*` secrets contain. This fails closed, which is correct — but it means restore is
   unproven.
3. **The `Staging` and `Recovery` GitHub environments do not exist**, and `Production`, `Monitoring`,
   `Backup` and `Preview` each contain zero secrets and zero variables.

## Commissioning checklist

Only these repository-level secrets exist today: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`,
`RESEND_API_KEY`, `RESEND_FROM`, `SESSION_RECOVERY_ACCESS_TOKEN_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`.

### Values that must be created

| Secret                      | Where to get it                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONITORING_TOKEN`          | Invent: `openssl rand -hex 32`. Must also be set in Vercel env, on all four Workers via `wrangler secret put`, and in any uptime monitor's request headers, or every readiness probe 401s |
| `VERCEL_TOKEN`              | Vercel → Account Settings → Tokens → Create Token, scoped to the owning team                                                                                                              |
| `SUPABASE_ACCESS_TOKEN`     | Supabase → Account → Access Tokens → Generate new token (one token covers both projects)                                                                                                  |
| `SUPABASE_DB_PASSWORD`      | Supabase → Project Settings → Database → Database password. **Different per environment**, so it must be an environment secret, not a repository secret                                   |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template                                                                                                                 |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare → Workers & Pages → Account ID, or `wrangler whoami`. Genuinely absent from the repo                                                                                           |
| `STAGING_LOCK_GITHUB_TOKEN` | GitHub PAT with `variables:write`, so the staging job can hold the deploy lock                                                                                                            |
| `MONITORING_HEARTBEAT_URL`  | An uptime provider's heartbeat URL, if one is adopted. Grace period must exceed 75 minutes                                                                                                |

### Values that already exist in the repository — copy, do not hunt

| Value                             | Source in repo                                                      |
| --------------------------------- | ------------------------------------------------------------------- |
| `VERCEL_ORG_ID`                   | `.vercel/project.json` (gitignored) — an identifier, not a secret   |
| `VERCEL_PROJECT_ID` (both envs)   | `scripts/deploy/environments.ts` records staging and production ids |
| Supabase project refs (both envs) | `scripts/db/safety.ts`                                              |
| D1 database and KV namespace ids  | `cloudflare/*/wrangler.jsonc`                                       |

### Shortest path to proving the pipeline works at all

`resolve-candidate` (the first job in `deploy.yml`) consumes **no secrets** — it runs on
`github.token`. Dispatching `Protected delivery` with a deliberately invalid `head_sha` is therefore
a zero-credential way to prove runner allocation works, before investing in any of the above. It
requires only that the workflow can get a runner.

## Runner health

The self-hosted runner publishes the seven checks the `main` ruleset requires, so **a dead runner
does not degrade CI -- it stops merges entirely, and silently.** The launchd supervisor
(`infra/local-ci/bin/runner-vm-supervise.sh`) now records health on every poll:

- `~/Library/Logs/nabatable-ci/runner-state.json` -- current state, updated each cycle.
- A macOS notification on each health _transition_ (not per poll).
- A dead-man's-switch ping to `NABATABLE_RUNNER_HEARTBEAT_URL`, sent **only** after a fully healthy
  check (VM running _and_ agent active). A VM that is up with a dead agent must not look healthy: it
  accepts no jobs, so required checks stay pending forever.

`NABATABLE_RUNNER_HEARTBEAT_URL` is unset by default, which means runner death is currently visible
only on this machine. Setting it to an uptime provider's heartbeat URL is the cheapest way to make
that reach a phone; the provider's grace period must exceed the poll interval (60s by default).

A related failure mode worth knowing: on 2026-09-06 a pull request was opened and GitHub did not
dispatch any of the `pull_request` workflows. The PR sat `BLOCKED` on required checks that were never
queued, with no signal anywhere. Pushing an empty commit (a `synchronize` event) dispatched all five
immediately. If a PR shows required checks as missing rather than failing, check that runs were
actually created before assuming the runner is at fault.

## Known good properties worth preserving

Not everything here is broken, and these were verified:

- **No PR job consumes a repository secret** beyond the automatic `GITHUB_TOKEN`; every PR lane uses
  sanitized test values.
- **`labeler.yml`'s `pull_request_target` is the safe pattern** — it checks out nothing and executes
  no candidate code.
- **No command-injection vector** — no `github.event.*` is interpolated into any `run:` block.
- **Supply-chain hygiene is genuinely strong**: `minimumReleaseAge: 1440`, pinned transitive
  `overrides`, `onlyBuiltDependencies`, SHA-256-verified scanner downloads, digest-pinned base images.
- **Many scripts fail closed** on placeholder or missing input rather than proceeding — including the
  recovery bucket and the release gate.
