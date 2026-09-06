# CI/CD current state

The other documents in `docs/ci/` and `docs/runbooks/` describe the **intended** CI/CD design. This
page records what is actually running, verified against the GitHub API and this repository on
**2026-09-06**. Where the two disagree, this page is correct.

Update this page whenever a row moves between tables.

## Selected delivery model: option A

On 2026-09-06 the owner selected **option A**: retain Vercel Git integration and
Cloudflare Workers Builds as the sanctioned production delivery path behind the existing
seven required PR checks. `Protected delivery` remains an inactive alternative; its contracts
are retained. The owner explicitly declined external heartbeat implementation.

The new `Git deployment verification` workflow observes the web app and three customer Workers
after pushes to protected main with bounded retries, hourly, or by manual dispatch from main. It is
**prepared, not commissioned**: hosted execution, enforced main-only Monitoring environment access, monitoring authentication, and Worker source
identity must be verified before claiming it is operating. See the
[Git delivery runbook](../runbooks/git-delivery.md). This observation cannot stop a deployment,
make multi-provider releases atomic, or automatically roll back a failed release.

## What actually deploys production

**Vercel's Git integration attempts production deployment on every push to `main`.** GitHub deployment
records show `vercel[bot]` creating `Production` deployments for recent `main` commits, including the
two `[skip ci]` commits that carried no CI evidence at all. Cloudflare Workers Builds deploys the
three customer-facing Workers on push.

Neither provider path consults the inactive release gate, a deployment approval, a staging soak,
or a smoke test. The existing main ruleset is the pre-merge control for option A.

> **Treat merging to `main` as initiating a production release. Verify the provider outcome
> and live source revision; an attempted deployment is not proof the commit became live.**

Live GitHub readback at approximately **23:27 BST on 2026-09-06** confirmed all seven required
contexts. Vercel deployment `6298664970` for main `b2f1611442456f4167f4c9e7cf1b63cb5b9e8cfe`
reported **failure / "Deployment was blocked"**. Vercel API readback later confirmed
`readyState: BLOCKED` because the commit author lacks permission to create deployments for
this project; no alias was assigned. GitHub identifies that author as `amanshresthaa`;
the preceding READY source commit was authored by `lapeninns`. Resolve provider author/team access through legitimate
account configuration before expecting that author's Git deployments to succeed. A later Vercel alias/API readback at approximately
23:39 BST resolved `app.nabatable.com` to READY deployment
`dpl_4sWK9u5T6MhUg8C6REzeKd9e84fe`, whose provider source SHA is
`0e9ada467e4449a9a4b5f7ac0ce534c4606a32cf`. This is provider metadata, not authenticated
readiness or end-to-end booking proof. The Monitoring environment still contained zero secrets, and operational
verification run `34060479324` failed with no job steps. Do not label that main revision live.
A later readback found Monitoring has no deployment branch policy and no protection rules;
an administrator must enforce main-only access before storing its readiness secret. The
authorized review account `amanshresthaa` has push access but no repository admin permission.

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
| Vercel production deploy    | ⚠️ live | Sanctioned Git integration; latest attempt blocked — see above             |
| Cloudflare Workers deploy   | ⚠️ live | Sanctioned Workers Builds; provider settings need readback                 |

## What is not operating

| Capability                    | State             | Why                                                                                |
| ----------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `Protected delivery`          | ❌ never ran      | `ubuntu-latest` + exhausted minutes; 0 of 21 secrets configured                    |
| `Release gate`                | ❌ never ran      | `ubuntu-latest`; also `allowedImageDigests` is a `REPLACE_ME`                      |
| CodeQL                        | ❌ never ran      | `ubuntu-latest` + exhausted minutes                                                |
| Hourly operational verifier   | ❌ never ran      | `ubuntu-latest`; `Monitoring` environment holds no secrets                         |
| Database backup (12-hourly)   | ❌ never ran      | `ubuntu-latest`; `Backup` environment holds no secrets                             |
| Restore drill                 | ❌ never ran      | Also blocked by a placeholder backup bucket (below)                                |
| DAST                          | ❌ never ran      | `ubuntu-latest`; `DAST_*` variables unset                                          |
| External alerting / heartbeat | Deferred by owner | Explicitly skipped on 2026-09-06; no heartbeat activation in option A              |
| Git deployment verification   | Prepared          | Hosted capacity, Monitoring token, email origin and Worker source identity pending |
| Local-first CI controller     | ❌ not built      | Superseded in practice by the stock self-hosted runner                             |

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

### Values that must be provisioned or securely reused

| Secret                      | Where to get it                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MONITORING_TOKEN`          | Vercel Production metadata confirms this key already exists (2026-09-06); do not rotate blindly. Securely reuse the matching value for the three customer Workers and main-restricted Monitoring environment. Worker matching values remain unverified |
| `VERCEL_TOKEN`              | Vercel → Account Settings → Tokens → Create Token, scoped to the owning team                                                                                                                                                                           |
| `SUPABASE_ACCESS_TOKEN`     | Supabase → Account → Access Tokens → Generate new token (one token covers both projects)                                                                                                                                                               |
| `SUPABASE_DB_PASSWORD`      | Supabase → Project Settings → Database → Database password. **Different per environment**, so it must be an environment secret, not a repository secret                                                                                                |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template                                                                                                                                                                              |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare → Workers & Pages → Account ID, or `wrangler whoami`. Genuinely absent from the repo                                                                                                                                                        |
| `STAGING_LOCK_GITHUB_TOKEN` | GitHub PAT with `variables:write`, so the staging job can hold the deploy lock                                                                                                                                                                         |
| `MONITORING_HEARTBEAT_URL`  | An uptime provider's heartbeat URL, if one is adopted. Grace period must exceed 75 minutes                                                                                                                                                             |

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
only on this machine. The owner explicitly chose to skip external heartbeat implementation on 2026-09-06. If that
decision changes, setting it to an uptime provider's heartbeat URL is the cheapest way to make
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
