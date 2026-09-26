# CI/CD current state

The booking-assignment recovery release uses an explicitly authorized current-user isolated
Lima runner with the `nabatable-release` label. Each job receives a disposable VM cloned from
a credential-free, prewarmed base. The seven required checks retain their commands, Node 22,
and sanitized test environments; fork pull requests cannot enter these self-hosted jobs.
Repository visibility remains private because retained history includes sensitive data.

**2026-09-26:** the repository was made public by the owner. The seven required jobs now choose
their runner with the repository variable `NABATABLE_CI_RUNNER`: `hosted` runs them on
GitHub-hosted `ubuntu-latest` (secret-less, the same path fork PRs use); unset or any other value
keeps the isolated `nabatable-release` lanes. Unset the variable before returning the repository
to private, where hosted minutes are budget-limited.
The historical snapshot below describes the earlier persistent self-hosted setup.

The other documents in `docs/ci/` and `docs/runbooks/` describe the **intended** CI/CD design. This
page records what is actually running, verified against the GitHub API and this repository on
**2026-09-07** (latest deployment readback approximately **02:32 BST**). Where the two disagree, this page is correct.

## Latest Option A release

PR #148 was rebase-merged at **02:06:38 BST** after all seven required checks passed on
`c600bcfe34316e9699fdbbdfbdd2870b38ddc3f6`. The resulting main commit is
`983a27eb48c65d9cb7f612cfe4f274011ce5b527`; its Git tree exactly matches the tested PR tree
(`a57279aad13c66f27fe9b255118f1f77a7d16bfb`). The active ruleset still requires the same seven
checks and has no bypass actors. The authorized `amanshresthaa` reviews of PRs #147 and #148
are explicitly agent-performed technical reviews, not independent human approval.

Vercel production deployment `dpl_GA2D8v4cSaQXNhJRNFhyN7MWoQ9f` is READY and assigned to
`app.nabatable.com`. Its actual commit author is the existing confirmed owner, `lapeninns`.
Authenticated readiness at **02:14:18 BST** confirmed the web and all three customer Workers
serve `983a27eb...`, with their complete expected dependency inventories healthy and protected
main unchanged before and after the probes. No additional Vercel seat or paid Actions capacity
was enabled. Future commits authored as `amanshresthaa` still have the separate, unconfirmed
Vercel membership limitation described below.

All four Cloudflare Builds succeeded on the resulting main revision:

| Worker              | Build ID                               | Completed (BST) |
| ------------------- | -------------------------------------- | --------------- |
| SMS summary         | `5d301da2-7793-4224-9301-0ee63e437706` | 02:08:40        |
| Email queue         | `6be5e2c7-e366-4117-af06-65cced683ac4` | 02:10:14        |
| Booking links       | `4fe4f631-f38f-4cbc-8c62-b37bf76243a7` | 02:11:55        |
| Operational control | `c0674d3c-7185-4f4e-8749-290f23bfb965` | 02:13:52        |

Operational-control version `757b0658-5bfb-42c7-bc1d-ad9b7a4f89ec` serves 100% of traffic and
reports the same source revision. Its configuration, coordinator and evidence bucket checks
passed. All four Workers retained their pre-release secret-binding name inventories.
PR #148 resolved the two earlier pre-upload test failures by skipping the email regex only
when the bearer-scrubbed string contains no `@`; regexes, filtering order, the 64 KiB oversized
fixture, size limit and five-second timeout remain unchanged. This is not a general linear-time
or production CPU guarantee.

The observer is deployed and enabled, and it has now executed. Authenticated retrieval at
**05:52 BST** returned the scheduled observation for `04:00:51Z`, so hourly eligibility against the
five-minute cron fires correctly. That observation **failed**: `ok` is false with the single failure
`github_observation_failed`, and `expectedSha` is `null`.

Because `expectedSha` is null, the run aborted on the GitHub side before any target was probed. The
four `request_failed` target entries in that evidence are the initialized placeholder values, not
four real probe results; they are not evidence that the web app or any Worker was unavailable.
`runDeploymentObservation` wrapped configuration validation, JWT creation, token mint, minted-scope
validation and the protected-main read in one `catch` that recorded a single generic reason, so that
stored evidence cannot say which step failed. That `catch` bound no error and logged nothing, so the
Worker's runtime logs are equally silent and cannot resolve it either.

Each step now records a distinct redacted reason: `invalid_config`, `github_jwt_failed`,
`github_token_mint_failed`, `github_token_absent`, `invalid_token_scope`, `main_unavailable` and
`invalid_main`. Only fixed enum values are stored, never error text or credentials, and an
unrecognised throw still falls back to the generic reason. The last two are deliberately separate: a
protected-main read that never completed has a different cause and a different fix from one that
returned but did not describe protected main. Elapsed time in the failed evidence was about nineteen
seconds, and because Cloudflare freezes the clock between I/O operations that is real network time.

That attribution deployed at **08:32 BST** as version `548542b4`. The **09:00 BST** observation named
the step: `github_token_mint_failed`.

The cause is a runtime incompatibility in the shared observation engine, confirmed by running the
call in `workerd` rather than inferred. `requestPostDeployJson` issued every request with
`redirect: 'error'`, which Cloudflare refuses outright: _"won't be implemented since it does not make
sense at the edge; use `manual` and check the response status code"_. The refusal throws, and
`requestPostDeployJson` catches everything and returns `null`, so **every** request through that
engine failed in the Workers runtime. The installation-token mint is simply the first one, which is
why no observation ever got further and why `expectedSha` was always null.

Node's `fetch` accepts `redirect: 'error'`, and the tests run under Node with a mocked fetcher, so
neither the suite nor the hosted script could ever have caught this. The engine works under Node and
fails entirely under Workers.

The fix sets `redirect: 'manual'` and refuses redirects by status instead. That fails closed on both
runtimes and still never follows a `Location` header, which an existing test already pins. A test now
asserts the option value so the Workers-incompatible one cannot return unnoticed.

### First successful scheduled observation

The corrected engine deployed at **11:28 BST** as version `53816da1`. Two hourly observations have
run on it.

| Scheduled (BST) | Result | Detail                                                               |
| --------------- | ------ | -------------------------------------------------------------------- |
| 12:00:31        | failed | `email-queue-gateway` returned `invalid_readiness`; other three `ok` |
| 13:00:31        | **ok** | All four targets `ok` on `f35e243c`, no failures                     |

The 13:00 run is the first successful scheduled observation. `expectedSha` matched `f35e243c` and
every target reported that same revision, so an independent executor has now confirmed the web app
and all three customer Workers serve current protected main.

The 12:00 `email-queue-gateway` failure was transient, not a schema or naming defect. That target's
`observedSha` was already correct, and its own authenticated readiness at 12:02 BST reported
`status: ok` with both `email-queue-state` and `capacity-version-state` healthy, which satisfies
every validator rule. It recovered without intervention by the next run.

**The observer probes each target once, with no retry.** The hosted executor it replaces makes up to
six observations with 30-second waits after transient failures. With four independent targets probed
once an hour, a single momentary failure in any one of them fails the whole hourly observation and
the next attempt is an hour away. Occasional red runs should therefore be expected even when the
platform is healthy. Adding retries costs CPU inside the same invocation, which is in direct tension
with the measurement below, so this is a deliberate open decision rather than an oversight.

### Measured CPU

Measured from `wrangler tail --format json` against version `53816da1`, reading `cpuTime` per
invocation:

| Invocation                       | CPU   | Wall    | Outcome | Exceptions |
| -------------------------------- | ----- | ------- | ------- | ---------- |
| Routine five-minute cron (12:55) | 8 ms  | 2632 ms | `ok`    | 0          |
| Hourly observation (13:00)       | 28 ms | 3416 ms | `ok`    | 0          |

The observer adds roughly 20 ms of CPU on top of the legacy cycle's 8 ms baseline.

**This contradicts the Workers Free limit assumed elsewhere on this page.** A 28 ms invocation
completed with outcome `ok` and no exceptions rather than being terminated, so the documented 10 ms
per-invocation ceiling did not apply to this scheduled invocation. Do not treat either figure as
settled: confirm the actual enforced limit for scheduled handlers on this account before using a CPU
number as a commissioning gate in either direction. The measurements above are reproducible; the
policy behind them is not yet established.

Retrieval behavior itself is correct and fails closed: unauthenticated requests return HTTP 401, and
the failed observation is served as HTTP 503 with `status: failed` rather than as success. Normal
five-minute invocations on the new version are successful; the hourly combined CPU cost remains a
separate qualification criterion.

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
qualification release; staging remains disabled. Deployment and authenticated readiness are verified.
It has now produced a successful scheduled observation of all four targets, and token mint,
revocation and CPU are all exercised and measured. It is still not declared commissioned here: the
enforced CPU limit for scheduled handlers on this account is not established, and the single-shot
probing described above makes occasional transient failures expected. Both are owner decisions. See the [Git delivery runbook](../runbooks/git-delivery.md).
Live cron analytics show scheduled timestamps with a two-second offset. Hourly eligibility therefore
uses UTC minute `00`, without assuming zero seconds or milliseconds; evidence retains the original
scheduled timestamp. Observation cannot stop a deployment, make multi-provider releases atomic, or roll back a failed release.

## What actually deploys production

**Vercel's Git integration attempts production deployment on every push to `main`.** GitHub deployment
records show `vercel[bot]` creating `Production` deployments for recent `main` commits, including the
two `[skip ci]` commits that carried no CI evidence at all. Cloudflare Workers Builds deploys the
three customer-facing Workers and operational-control from protected main on push.

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
owner rebase merge without purchasing an additional Vercel seat. That preview did not establish production liveness; the subsequent production release and
authenticated readback are recorded above.

At approximately 00:11 BST on 2026-09-07, owner-dashboard readback confirmed all three customer
Workers build `lapeninns/nabatable` from `main`, root `/`, include path `*`, no exclusions, and
non-production branch builds disabled. Each runs its package `verify`, followed by production
Worker separation validation and `deploy:workers --revision "$(git rev-parse HEAD)"` with its
correct production URL. Existing build secrets supply `MONITORING_TOKEN`; no commands or secrets
were changed. Operational-control was subsequently connected through the Builds API to the same protected-main,
all-path repository source (trigger `7ae8d730-6c18-4325-988b-db83a47ac4b2`), with its package verification,
separation check, revision-aware deploy command and encrypted monitoring build secret. This is
configuration evidence; the later successful Git build and served revision are recorded above. The existing Cloudflare account is on Workers Free (10 ms CPU per invocation);
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

| Capability                  | State   | Notes                                                                               |
| --------------------------- | ------- | ----------------------------------------------------------------------------------- |
| PR and `main` test lanes    | ✅ live | Self-hosted `nabatable` runner; 7 checks, ~0 hosted Actions minutes                 |
| `main` branch protection    | ✅ live | Ruleset: PR required, linear history, no force-push, no deletion, 7 checks          |
| CI contract validation      | ✅ live | `pnpm ci:contracts:validate` runs inside `Security guards`                          |
| Secret scanning             | ✅ live | gitleaks + trufflehog, SHA-256 pinned, architecture-aware                           |
| Local runner crash recovery | ✅ live | launchd supervisor restarts the VM and the agent                                    |
| Vercel production deploy    | ✅ live | Owner-authored production release and alias/readiness verified — see latest release |
| Cloudflare customer deploys | ✅ live | Three sanctioned main Builds and authenticated source convergence verified          |
| Operational-control deploy  | ✅ live | Protected-main Git build and authenticated source/configuration checks passed       |

## What is not operating

| Capability                    | State             | Why                                                                             |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `Protected delivery`          | ❌ never ran      | `ubuntu-latest` + exhausted minutes; 0 of 21 secrets configured                 |
| `Release gate`                | ❌ never ran      | `ubuntu-latest`; also `allowedImageDigests` is a `REPLACE_ME`                   |
| CodeQL                        | ❌ never ran      | `ubuntu-latest` + exhausted minutes                                             |
| Hourly operational verifier   | ❌ never ran      | `ubuntu-latest`; `Monitoring` environment holds no secrets                      |
| Database backup (12-hourly)   | ❌ never ran      | `ubuntu-latest`; `Backup` environment holds no secrets                          |
| Restore drill                 | ❌ never ran      | Also blocked by a placeholder backup bucket (below)                             |
| DAST                          | ❌ never ran      | `ubuntu-latest`; `DAST_*` variables unset                                       |
| External alerting / heartbeat | Deferred by owner | Explicitly skipped on 2026-09-06; no heartbeat activation in option A           |
| Git deployment verification   | Prepared          | Hosted opt-in disabled; Cloudflare observer now observing, not yet commissioned |
| Local-first CI controller     | ❌ not built      | Superseded in practice by the stock self-hosted runner                          |

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
