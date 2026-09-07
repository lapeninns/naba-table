# CI/CD current state

The other documents in `docs/ci/` and `docs/runbooks/` describe the **intended** CI/CD design. This
page records what is actually running, verified against the GitHub API and this repository on
**2026-09-07** (latest deployment readback approximately **01:39 BST**). Where the two disagree, this page is correct.

## Latest Option A release

PR #147 was rebase-merged at **01:24:51 BST** after all seven required checks passed on
`83afe56cfafbc2cc8e45f81e78867abd4dcffc80`. The resulting main commit is
`e29625c41b468d25c065aa50e3b0a3c543c25bab`; its Git tree exactly matches the tested PR tree.
The active ruleset still requires the same seven checks and has no bypass actors.
The authorized `amanshresthaa` review is explicitly agent-performed technical review, not
independent human approval.

Vercel production deployment `dpl_AeAqNDNC453oQvbgvP8EJGrSJYrA` is assigned to
`app.nabatable.com`. Its actual commit author is the existing confirmed owner, `lapeninns`.
Authenticated readiness confirms the web and all three customer Workers serve `e29625c4...`,
with their complete expected dependency inventories healthy and protected main unchanged
before and after the probes. Their three Cloudflare Builds succeeded. No additional Vercel
seat or paid Actions capacity was enabled. Future commits authored as `amanshresthaa` still
have the separate, unconfirmed Vercel membership limitation described below.

Operational-control did not deploy: its first Git build and one exact-commit retry failed
before upload at the existing oversized-evidence coverage test (7,849 ms and 6,511 ms against
the unchanged 5,000 ms timeout). The previously deployed version
`da8733c9-3941-4456-afee-7a03403fefbe`, source
`db55a4d2351d5bcae29182ffae6f367359f32a0a`, remains healthy. Local profiling identified the
email regex's failed search over a 64 KiB no-`@` string as the expensive operation. The reviewed
follow-up skips only that impossible match, retaining bearer/email/phone order, regexes,
the oversized fixture, size limit and timeout. Local profiling dropped from about 2,061 ms
to 0.031 ms for that case; this is not a general linear-time or production CPU guarantee.
The corrected provider build, first real hourly observation and runtime CPU evidence remain
required before commissioning. There is no further retry of the unchanged failed build planned.

Update this page whenever a row moves between tables.

## Selected delivery model: option A

On 2026-09-06 the owner selected **option A**: retain Vercel Git integration and
Cloudflare Workers Builds as the sanctioned production delivery path behind the existing
seven required PR checks. `Protected delivery` remains an inactive alternative; its contracts
are retained. The owner explicitly declined external heartbeat implementation.

The hosted `Git deployment verification` workflow is prepared but disabled unless the repository
variable `HOSTED_POST_DEPLOY_VERIFICATION_ENABLED` is explicitly `true`. The owner declined paid
GitHub Actions; the account remains capped at $0 with all included minutes consumed. Production
credentials must not move onto the shared PR runner.

An hourly observer in the existing operational-control Worker is being qualified as the
independent executor. The reviewed production configuration explicitly enables it for a controlled
qualification release; staging remains disabled. It is not yet commissioned: provider deployment,
real token-response compatibility, CPU-limit evidence and successful hourly evidence are still required. See the [Git delivery runbook](../runbooks/git-delivery.md).
Live cron analytics show scheduled timestamps with a two-second offset. Hourly eligibility therefore
uses UTC minute `00`, without assuming zero seconds or milliseconds; evidence retains the original
scheduled timestamp. Observation cannot stop a deployment, make multi-provider releases atomic, or roll back a failed release.

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
Subsequent administrator configuration enforced an exact `main` branch policy for Monitoring.
A non-main dispatch of operational verification (run `34065272131`) was rejected by the environment
before any job step. Monitoring still holds no secret because hosted execution remains disabled.
The authorized account `lapeninns` has administrator access; `amanshresthaa` has push access.

Authenticated readiness probes later returned HTTP 200 and `status: ok` with complete dependency
checks for all four customer services using the existing matching token. The web still served
`0e9ada467e4449a9a4b5f7ac0ce534c4606a32cf`, while all three Workers served
`b2f1611442456f4167f4c9e7cf1b63cb5b9e8cfe`. This is a source mismatch, not a verified current-main release.
PR #147's actual `lapeninns`-authored head received a READY Vercel preview, supporting a legitimate
owner rebase merge without purchasing an additional Vercel seat. Production remains unverified
until the resulting Git build and authenticated served revision pass.

At approximately 00:11 BST on 2026-09-07, owner-dashboard readback confirmed all three customer
Workers build `lapeninns/nabatable` from `main`, root `/`, include path `*`, no exclusions, and
non-production branch builds disabled. Each runs its package `verify`, followed by production
Worker separation validation and `deploy:workers --revision "$(git rev-parse HEAD)"` with its
correct production URL. Existing build secrets supply `MONITORING_TOKEN`; no commands or secrets
were changed. Operational-control was subsequently connected through the Builds API to the same protected-main,
all-path repository source (trigger `7ae8d730-6c18-4325-988b-db83a47ac4b2`), with its package verification,
separation check, revision-aware deploy command and encrypted monitoring build secret. This is
configuration evidence; it still serves the preceding manual Wrangler release until a build succeeds. The existing Cloudflare account is on Workers Free (10 ms CPU per invocation);
low request usage alone does not establish that the new observer fits that limit.

The dispatch App `4841783` installation `159307594` was granted the required read-only contents
permission and accepted by the owner. Installation readback remains limited to the single
`lapeninns/nabatable` repository; existing permissions are actions write, and checks, contents,
metadata and pull requests read. No App key was copied. The existing operational R2 bucket's
`operational-evidence-14d` lifecycle applies to all prefixes, including `post-deploy/v1/`.

`Protected delivery` (`.github/workflows/deploy.yml`) — the evidence-gated, staged, approved pipeline
that `docs/runbooks/staging-release.md` describes — **has never run successfully**. Its last twenty
runs are eleven `startup_failure`, one `skipped`, zero successes.

## What is operating

| Capability                  | State      | Notes                                                                                 |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| PR and `main` test lanes    | ✅ live    | Self-hosted `nabatable` runner; 7 checks, ~0 hosted Actions minutes                   |
| `main` branch protection    | ✅ live    | Ruleset: PR required, linear history, no force-push, no deletion, 7 checks            |
| CI contract validation      | ✅ live    | `pnpm ci:contracts:validate` runs inside `Security guards`                            |
| Secret scanning             | ✅ live    | gitleaks + trufflehog, SHA-256 pinned, architecture-aware                             |
| Local runner crash recovery | ✅ live    | launchd supervisor restarts the VM and the agent                                      |
| Vercel production deploy    | ✅ live    | Owner-authored production release and alias/readiness verified — see latest release   |
| Cloudflare customer deploys | ✅ live    | Three sanctioned main Builds and authenticated source convergence verified            |
| Operational-control deploy  | ⚠️ blocked | Git build stopped at oversized-evidence test; reviewed performance correction pending |

## What is not operating

| Capability                    | State             | Why                                                                     |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `Protected delivery`          | ❌ never ran      | `ubuntu-latest` + exhausted minutes; 0 of 21 secrets configured         |
| `Release gate`                | ❌ never ran      | `ubuntu-latest`; also `allowedImageDigests` is a `REPLACE_ME`           |
| CodeQL                        | ❌ never ran      | `ubuntu-latest` + exhausted minutes                                     |
| Hourly operational verifier   | ❌ never ran      | `ubuntu-latest`; `Monitoring` environment holds no secrets              |
| Database backup (12-hourly)   | ❌ never ran      | `ubuntu-latest`; `Backup` environment holds no secrets                  |
| Restore drill                 | ❌ never ran      | Also blocked by a placeholder backup bucket (below)                     |
| DAST                          | ❌ never ran      | `ubuntu-latest`; `DAST_*` variables unset                               |
| External alerting / heartbeat | Deferred by owner | Explicitly skipped on 2026-09-06; no heartbeat activation in option A   |
| Git deployment verification   | Prepared          | Hosted version opt-in disabled; Cloudflare observer under qualification |
| Local-first CI controller     | ❌ not built      | Superseded in practice by the stock self-hosted runner                  |

**No independent backup of this database has ever been taken, and no restore has ever been timed.**

## Three blockers that are not credentials

1. **Hosted Actions minutes are exhausted.** Every `ubuntu-latest` job fails to start with
   _"The job was not started because recent account payments have failed or your spending limit needs
   to be increased."_ This alone explains every `startup_failure` above. Resolve in
   GitHub → Settings → Billing only if the owner later authorizes it. Paid Actions is currently disabled by request. Secret-bearing jobs cannot migrate to the shared PR runner; qualify an isolated executor.
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

| Secret                      | Where to get it                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONITORING_TOKEN`          | Vercel Production metadata confirms this key already exists (2026-09-06); do not rotate blindly. Securely reuse the matching value for the three customer Workers and main-restricted Monitoring environment. Authenticated probes confirmed the existing value matches all four customer services; hosted Monitoring remains intentionally empty |
| `VERCEL_TOKEN`              | Vercel → Account Settings → Tokens → Create Token, scoped to the owning team                                                                                                                                                                                                                                                                      |
| `SUPABASE_ACCESS_TOKEN`     | Supabase → Account → Access Tokens → Generate new token (one token covers both projects)                                                                                                                                                                                                                                                          |
| `SUPABASE_DB_PASSWORD`      | Supabase → Project Settings → Database → Database password. **Different per environment**, so it must be an environment secret, not a repository secret                                                                                                                                                                                           |
| `CLOUDFLARE_API_TOKEN`      | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template                                                                                                                                                                                                                                                                         |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare → Workers & Pages → Account ID, or `wrangler whoami`. Genuinely absent from the repo                                                                                                                                                                                                                                                   |
| `STAGING_LOCK_GITHUB_TOKEN` | GitHub PAT with `variables:write`, so the staging job can hold the deploy lock                                                                                                                                                                                                                                                                    |
| `MONITORING_HEARTBEAT_URL`  | An uptime provider's heartbeat URL, if one is adopted. Grace period must exceed 75 minutes                                                                                                                                                                                                                                                        |

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
