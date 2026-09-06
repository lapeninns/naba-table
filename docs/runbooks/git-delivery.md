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
prove booking/provider journeys. The operational-control Worker is excluded because it is a
separate control plane. Existing `ops:verify` retains its broader backup/recovery/control-plane
semantics and is not substituted for strict deployment acceptance.

## Commissioning requirements

1. Restore hosted GitHub Actions capacity, or separately design and qualify an isolated
   monitoring executor. Do not place production credentials on the shared PR runner.
2. Before adding a secret, have a repository administrator configure and verify an enforced
   `Monitoring` deployment branch policy allowing only the protected `main` branch, with no
   tags or other branches. A job-level condition and `checkout: main` cannot protect a secret
   from workflow YAML modified on a writable branch. Test that a non-main dispatch/deployment
   cannot access the environment. If the account plan cannot satisfy that policy, keep credentials unconfigured until that
   restriction can be enforced; never open the environment to all branches.
3. Configure a matching `MONITORING_TOKEN` in the production web app, three customer Workers,
   and GitHub's `Monitoring` environment. Use secure provider configuration, never commit or
   paste values in a review. Do not rotate a currently configured token without coordinating
   its consumers. The verifier uses `github.token` for read-only main queries; it does not need
   a separate personal GitHub token or Vercel/Cloudflare/DB deployment credentials.
4. Set `MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL` in `Monitoring` to the actual production HTTPS
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
7. Resolve any provider deployment failures, then dispatch `Git deployment verification` from
   main. Inspect its redacted artifact and establish a successful observation of all four
   current source identities. Confirm one automatic main-push run and a later scheduled
   run before moving the workflow into the operating table in `docs/ci/current-state.md`.

The owner explicitly declined heartbeat implementation. No external heartbeat is emitted by
this workflow. Review failures in Actions; there is no newly commissioned out-of-band alert.
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
