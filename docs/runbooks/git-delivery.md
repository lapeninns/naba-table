# Git production delivery (option A)

The owner selected this model on 2026-09-06. The existing seven required PR checks protect
`main`; Vercel Git integration and Cloudflare Workers Builds initiate production deployments
from that branch. A merge is a production release action. Verify the provider result and
served source revision before reporting a commit live. A failed or blocked provider build
does not establish which revision is currently serving traffic.

`Protected delivery` and `Release gate` remain the inactive alternative. Preserve their
contracts and safety guards. This decision does not commission their migration, staging,
backup, promotion, or rollback machinery. Applied migrations remain immutable and database
changes still require the staging-first database runbook.

## Post-deployment observation

The owner declined paid GitHub Actions on 2026-09-06. The hosted workflow below now requires
`HOSTED_POST_DEPLOY_VERIFICATION_ENABLED=true` at job admission; absent/false skips allocation.
It must remain disabled until hosted execution is separately authorized.

The alternative under qualification is an hourly observer in the existing operational-control
Worker, using the same runtime-neutral engine in `cloudflare/shared/post-deploy.ts`. It requires
an explicit production environment and enable flag, independently of the legacy scheduled
control-plane cycle. It uses the existing remote dispatch App key to mint a fresh token limited
to this repository and `contents: read`, validates the returned grant, and revokes that token
after observation. It never imports a host CI key or uses the dispatch client's broader token.
The App key remains a broader control-plane credential; token downscoping is not a separate
runtime security boundary.

Redacted results belong to a separate R2 namespace, including failed observations, with
conditional latest-pointer updates. An authenticated GET retrieves cached evidence and must
validate its schema, four unique services, timestamp and 75-minute freshness. Cached success
only describes the recorded SHA; it does not freshly prove that GitHub main is unchanged.
There is no new heartbeat or incident mutation.

Do not call this alternative commissioned until its code is reviewed, deployed through an
authorized provider path, and has produced successful scheduled evidence within the existing
Workers Free CPU limit. The operational-control Worker now has a protected-main Git-build connection with its monitoring
secret. Its first successful build and authenticated readiness are recorded in
[the current-state record](../ci/current-state.md); successful hourly observation remains a separate
runtime qualification requirement. The first scheduled observations failed before any target was
probed. Per-step attribution identified the installation-token mint, and the cause was a shared
engine that issued every request with a redirect mode the Workers runtime refuses, so no request
could ever succeed there. After that correction the observer produced a fully successful scheduled
observation of all four targets, and CPU was measured directly. All of this is recorded in that page.

Two questions remain open before commissioning, and both are owner decisions rather than defects.
The enforced CPU limit for scheduled handlers on this account is not established: an invocation
measured at 28 ms completed normally, which the documented 10 ms ceiling would not allow. The
observer also probes each target once with no retry, unlike the hosted executor's six bounded
attempts, so a single transient failure fails that hour's observation.

### Production qualification and disabling the observer

The reviewed qualification release explicitly sets `POST_DEPLOY_OBSERVER_ENABLED=true` in
both top-level production vars and the mirrored `env.production` block. `env.staging` stays
false. In this repository `deploy:workers --env production` deliberately invokes Wrangler
without `--env`, so **top-level configuration is the deployed production configuration**.
Changing only the mirrored block does not enable or disable the served observer.

The first scheduled observation is runtime qualification, not a prior promise of success.
After the hourly cron slot (UTC minute `00`, allowing provider seconds/milliseconds), inspect the cached four-target report, timestamps, token
cleanup diagnostics, invocation result and CPU usage. Also confirm the legacy cycle still runs.
The observer shares that invocation's CPU budget: settled promises isolate normal failures,
but cannot protect the legacy cycle from whole-invocation CPU exhaustion. The Workers Free
limit is 10 ms, and baseline control-plane samples already occasionally exceed it.

If qualification fails or disrupts the control plane, set both production declarations to
false through a checked PR, updating the production configuration assertion as part of that
rollback. Retain staging false. That is a further Git release and is not instantaneous recovery.
Do not perform a partial bindings-array PATCH: it can remove existing provider bindings. No
customer Worker, database or application rollback is implied by disabling this observer.

### Optional hosted executor

`.github/workflows/post-deployment-verification.yml` runs the standalone
`scripts/monitoring/post-deploy.ts` verifier on an ephemeral hosted Node 22 runner under the
`Monitoring` environment. It starts on pushes to main and also runs hourly or by manual
dispatch from main. Each run makes up to six observations, with 30-second waits after transient
failures, while the providers finish their independent builds. Configuration and trust failures
stop immediately. A slow deployment may exhaust this bounded window; a later hourly/manual
observation provides new evidence. A superseded push cannot certify the newer source.

Production GitHub deployment records inspected on 2026-09-06 use a commit-only ref and set
`production_environment: false` despite their `Production` environment name. Consequently
`deployment_status` is not used: those refs cannot satisfy a main-only Monitoring branch policy.
The protected-main push supplies a source identity without relying on these provider fields.

The workflow checks out protected main, uses read-only GitHub permissions, installs only the
pinned TypeScript runner, and gives the readiness token only to the verifier step. It must
never run on the persistent `nabatable` PR runner. Restoring hosted capacity is an activation
requirement; changing the runner label alone is not a safe workaround.

The verifier reads current main's immutable source SHA, probes the web app and all three
customer-facing Workers, then rereads main. Success requires HTTP 200, the expected service,
`status: ok`, healthy checks, and the expected full source SHA from every target. Degraded
responses, missing configuration, redirects, bad JSON, absent revisions and Cloudflare version
UUIDs fail. If main advances during the observation, the run cannot certify current main.
Authenticated destinations come from trusted production configuration, never deployment-event
URLs. Output contains redacted diagnostics rather than tokens, raw payloads or provider errors.

This is read-only observation after release. It cannot prevent an unhealthy release, make
Vercel and Workers deployment atomic, perform rollback, prove migration compatibility, or
prove booking/provider journeys. The operational-control Worker is excluded from the four observed customer services because it is a
separate control plane; it can host the observer without certifying itself. Existing `ops:verify` retains its broader backup/recovery/control-plane
semantics and is not substituted for strict deployment acceptance.

## Commissioning requirements

1. Qualify the existing Cloudflare monitoring executor, or restore hosted GitHub Actions capacity only after explicit owner authorization. Do not place production credentials on the shared PR runner.
2. For the optional hosted executor, before adding a secret, have a repository administrator configure and verify an enforced
   `Monitoring` deployment branch policy allowing only the protected `main` branch, with no
   tags or other branches. A job-level condition and `checkout: main` cannot protect a secret
   from workflow YAML modified on a writable branch. Test that a non-main dispatch/deployment
   cannot access the environment. If the account plan cannot satisfy that policy, keep credentials unconfigured until that
   restriction can be enforced; never open the environment to all branches.
3. For the optional hosted executor, configure a matching `MONITORING_TOKEN` in the production web app, three customer Workers,
   and GitHub's `Monitoring` environment. Use secure provider configuration, never commit or
   paste values in a review. Do not rotate a currently configured token without coordinating
   its consumers. The verifier uses `github.token` for read-only main queries; it does not need
   a separate personal GitHub token or Vercel/Cloudflare/DB deployment credentials.
4. For the optional hosted executor, set `MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL` in `Monitoring` to the actual production HTTPS
   origin. Verify all four targets against the providers; the other three origins are fixed in
   `config/observability/monitoring.yaml` and are not overridden by event input.
5. Inspect each Worker's actual Git-build root, production branch, deploy command and path
   filters. The current verifier deliberately requires all four services to report current
   main. Ensure all three Workers build for each main commit before commissioning. If selective
   builds are wanted, implement and review a per-service source mapping first; do not relax
   revision matching or label a stale/UUID revision verified.
6. Preserve existing Worker migration/predeploy behavior when adding source identity. Cloudflare
   supplies `WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH` in
   [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
   The deployed Worker must receive that validated full source SHA as `DEPLOY_SHA` (for example,
   a literal Wrangler argument `--var "DEPLOY_SHA:$WORKERS_CI_COMMIT_SHA"` in the reviewed
   production deploy command). Merely setting a build-process variable does not set a Worker
   runtime binding. Never replace the existing deploy command blindly: the booking wrapper
   also applies D1 migrations. The Vercel explicit `NABATABLE_SOURCE_REVISION`, if set, must not
   shadow the correct `VERCEL_GIT_COMMIT_SHA` with a stale value.
7. Resolve provider deployment failures and verify actual served revisions. For the Cloudflare
   observer, wait for a real UTC minute-`00` invocation, inspect authenticated cached evidence
   and runtime metrics, and apply the qualification criteria above before moving it into the
   operating table in `docs/ci/current-state.md`. This observer is hourly; it does not run on
   every push. For a separately authorized hosted executor, dispatch `Git deployment verification`
   from main and establish one automatic main-push run and a later scheduled run. Inspect its
   redacted artifact and require all four current source identities.

The owner explicitly declined heartbeat implementation. No external heartbeat is emitted by
either executor. Inspect authenticated cached evidence for the Cloudflare observer, or Actions
for a separately enabled hosted executor; there is no newly commissioned out-of-band alert.
Do not add this post-deployment job as a required PR check: it runs after the production release.

## Review, recovery and rollback

Keep all seven existing branch checks until a separately reviewed consolidation has executable
equivalence evidence. Agent review under an authorized GitHub account is agent-performed
technical review; it is not evidence that the named person independently reviewed the change.

Backups and restore drills remain separately blocked. They need an isolated executor, a real
encrypted backup bucket, a dedicated production read-only identity and a separately authorized
disposable restore target. Do not run the drill against an existing production or staging
project, and do not move its secrets onto the PR runner. Follow [recovery](recovery.md).

On failed observation, inspect the affected provider and source identity, then choose an
explicit recovery action. There is no automatic rollback here. A previous verified web or
Worker release must be checked against the current schema before rollback. To undo this
observation feature, revert the workflow and verifier through a PR; provider Git deployments
and existing branch checks continue unchanged. Reverting application code is itself another
production deployment and may not reverse a database migration.
