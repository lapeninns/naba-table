# Operational-control Worker

`@nabatable/operational-control` is the Cloudflare Worker control plane for the
local-first CI/CD pipeline. It never runs tests or deploys anything itself. It:

- verifies GitHub webhooks and records them in a SQLite-backed Durable Object;
- coalesces the Mac controller's `Local CI / <profile>` check run and the
  required hosted workflow completions into one queued `Release gate` dispatch per
  CI request tuple and hosted run attempt set, after an authoritative GitHub API
  readback. Completed failures dispatch too; a newer successful rerun can recover
  the gate. Persisted attempt fingerprints ignore duplicates and stale events;
- tracks the Mac controller heartbeat (alert at 15 minutes, fallback-eligible
  at 60 minutes);
- probes the readiness endpoints of the web app and the three customer Workers
  every five minutes with `MONITORING_TOKEN` (GET only, 5 s timeout);
- keeps incident state (one active incident per service/environment/failure
  class, escalation after 15 unacknowledged minutes, resolution after three
  consecutive healthy observations);
- writes redacted, size-capped evidence to R2 and pings the uptime heartbeat URL
  only after a fully valid cycle, so a silent Worker reads as an outage upstream.

Runtime note: the Worker records `activeRuntime: node22` and
`candidateRuntime: node24` in heartbeats, readiness and cycle evidence. Node 24
is a qualification candidate only; nothing here flips runtimes.

## Routes

| Route                              | Auth                                    | Purpose                                                                                         |
| ---------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /health`                      | none                                    | Liveness only.                                                                                  |
| `GET /ready`                       | `Bearer MONITORING_TOKEN`               | Revision from `CF_VERSION_METADATA` plus bounded coordinator + R2 checks.                       |
| `GET /deployment-verification`     | `Bearer MONITORING_TOKEN`               | Cached, redacted four-service deployment evidence; 503 when disabled, stale, invalid or failed. |
| `POST /github/webhook`             | `X-Hub-Signature-256` over raw bytes    | Webhook intake (see contract below).                                                            |
| `POST /heartbeat`                  | `Bearer HEARTBEAT_TOKEN`                | Mac controller heartbeat; credential-like keys are rejected.                                    |
| `POST /incidents/{id}/acknowledge` | `Bearer INCIDENT_ACKNOWLEDGEMENT_TOKEN` | Stops escalation for one active incident.                                                       |
| cron `*/5 * * * *`                 | n/a                                     | Readiness probes, heartbeat/evidence freshness, retry queue tick.                               |

The full schema is in [`openapi.yaml`](./openapi.yaml).

### Optional hourly deployment observation

`POST_DEPLOY_OBSERVER_ENABLED=true` and `DEPLOYMENT_ENVIRONMENT=production` enable an independent
observation at the exact hourly slot of the existing five-minute cron. The production configuration is explicitly enabled for qualification; staging stays disabled.
Missing enablement or a non-production environment disables the observer. It probes the four fixed production customer services against one protected-main
SHA, rechecks main, and stores redacted results under `post-deploy/v1/` in the existing evidence
bucket. The dedicated GitHub installation token grants only repository-scoped contents read and
is revoked after the attempt, including failed attempts. The existing remote App key stays in
the Worker; never transfer a host CI key to enable this feature.

`GET /deployment-verification` returns `cached: true` with `status: ok` only when validated
schema-version-1 evidence is healthy and at most 75 minutes old. It includes the observed SHA,
all four services, their finite diagnostics and timestamps. It returns 503 for failed, stale,
malformed, missing or disabled evidence; 401 for missing or invalid monitoring authentication.
GET does not perform new probes or freshly establish GitHub main. There is no POST endpoint,
new heartbeat, deployment mutation, automatic rollback or promotion decision. The legacy cycle
and observer settle independently; rejected cycles preserve failed scheduled-invocation status.

Commissioning and current live limitations are recorded in
[Git delivery](../../docs/runbooks/git-delivery.md) and
[current state](../../docs/ci/current-state.md). The account's CPU limit, real App token response,
first hourly evidence and bucket lifecycle must be verified before declaring this observer commissioned.

### Webhook contract (fail closed)

Every rule below rejects the delivery when it does not hold:

1. Payload is at most 512 KiB.
2. `X-Hub-Signature-256` is a valid HMAC-SHA256 of the **raw request bytes**
   (constant-time comparison). Re-serialized JSON does not verify.
3. `repository.id` equals `REPOSITORY_ID`.
4. `X-GitHub-Event` is one of `check_run`, `check_suite`, `pull_request`,
   `push`, `workflow_run`.
5. `check_run.app.id` is `LOCAL_CI_APP_ID` (Mac controller) or `15368` (GitHub
   Actions). Local check runs must be named `Local CI / <profile>` and carry the
   CI request tuple key (`nabatable-ci/v1:<fields>`, see below) in `external_id`.
6. The event timestamp is inside a one-hour replay window (5 minutes of future
   skew tolerated).
7. `X-GitHub-Delivery` has not been seen in the last 24 hours (the Durable
   Object deduplicates; replays return `200 {"duplicate":true}`).

Webhook success flags are never trusted. Before dispatch the coordinator re-reads
the check runs for the SHA, the pull request, and the workflow runs from the
GitHub API and refuses on any mismatch.

### CI request tuple

```json
{
  "repositoryId": "…",
  "profile": "pr | main | nightly",
  "prNumber": 42,
  "headSha": "…40 hex…",
  "baseSha": "…40 hex…",
  "testedSha": "…synthetic merge SHA for PRs, merged SHA for main…",
  "policyVersion": "…",
  "imageDigest": "sha256:…",
  "controllerVersion": "…",
  "attempt": 1
}
```

The candidate key is the SHA-256 of the whole tuple; a new attempt is a new
candidate with its own single dispatch.

On the wire the tuple is the deterministic **tuple key** the Mac controller
publishes as the check run `external_id` and the release gate binds evidence to:

```text
nabatable-ci/v1:<repositoryId>:<profile>:<prNumber|none>:<headSha>:<baseSha>:<testedSha>:<policyVersion>:<imageDigest>:<controllerVersion>:<attempt>
```

`webhook.ts` `parseCiRequestTuple` accepts only this format (12 `:`-separated
fields, `imageDigest` carries its own colon), validates every field, and requires
the parsed tuple to re-serialize byte for byte; JSON or non-canonical spellings
are rejected as `invalid_tuple`. The same function is used for the authoritative
`external_id` readback before dispatch.

The gate is dispatched with the discrete `workflow_dispatch` inputs declared by
`.github/workflows/release-gate.yml` (`repository_id`, `pr_number` (empty for
main), `head_sha`, `base_sha`, `tested_sha`, `attempt`, `requested_by`); GitHub
rejects undeclared inputs with 422, and `tests/scripts/ci/phase1/lane-contracts.test.ts`
keeps the Worker's input keys identical to the workflow's.

### Dispatch policy

`github.ts` only ever dispatches `GATE_WORKFLOW_ID` or
`SCHEDULED_VALIDATION_WORKFLOW_ID`, and only on `refs/heads/main`. Any other
workflow id or ref throws `GitHubDispatchPolicyError` before an HTTP request is
made. `FALLBACK_WORKFLOW_ID` (display name `Hosted profile fallback`) is listed
for readback only and is **never** dispatched automatically. Transport failures
retry with bounded exponential backoff (30 s, 60 s, 120 s, 240 s, 480 s; six
attempts total) driven by Durable Object alarms, then the candidate is marked
`failed` and an incident is opened.

## Bindings

| Binding               | Type                           | Notes                                                                   |
| --------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `COORDINATOR`         | Durable Object (`Coordinator`) | SQLite storage (`new_sqlite_classes`). Single instance named `primary`. |
| `EVIDENCE_BUCKET`     | R2                             | Redacted JSON under `evidence/YYYY/MM/DD/<kind>/<id>.json`; 64 KiB cap. |
| `CF_VERSION_METADATA` | Version metadata               | Exposed as `revision` on `/ready`.                                      |

Configure a **14-day lifecycle rule** on each evidence bucket; the Worker assumes
it and records `retentionDays: 14` in every object.

### Vars (`wrangler.jsonc`)

| Var                                | Meaning                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REPOSITORY_ID`                    | Numeric GitHub repository id.                                                                                                                                                              |
| `LOCAL_CI_APP_ID`                  | GitHub App id of `nabatable-local-ci` (Mac controller).                                                                                                                                    |
| `GATE_WORKFLOW_ID`                 | Numeric workflow id of `release-gate.yml`.                                                                                                                                                 |
| `FALLBACK_WORKFLOW_ID`             | Numeric workflow id of `Hosted profile fallback` (readback only).                                                                                                                          |
| `SCHEDULED_VALIDATION_WORKFLOW_ID` | Numeric workflow id of the scheduled validation workflow.                                                                                                                                  |
| `PROTECTED_REF`                    | Must be exactly `refs/heads/main`.                                                                                                                                                         |
| `TARGETS_JSON`                     | JSON array of `{name, environment, url}` readiness targets (https only, max 10).                                                                                                           |
| `REQUIRED_HOSTED_WORKFLOWS`        | Optional comma-separated workflow paths; defaults to the two trusted hosted lanes the release gate requires (`security-guards.yml`, `codeql.yml`), which run on every PR and push to main. |

Every `REPLACE_ME_*` value (and every lowercase `replace-me-*` R2 bucket name, since R2
requires lowercase names) is treated as **unconfigured**: `/ready` reports
`503`, the webhook route answers `503`, and the scheduled cycle never pings the
uptime URL until the real ids are recorded.

### Secrets (never in vars)

Set per environment with `wrangler secret put <NAME> --env <env>`:

| Secret                            | Used by                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET`           | Webhook signature verification (16+ chars).                                                     |
| `GITHUB_DISPATCH_APP_ID`          | `nabatable-ci-dispatch` GitHub App id.                                                          |
| `GITHUB_DISPATCH_APP_PRIVATE_KEY` | **PKCS#8** PEM (`openssl pkcs8 -topk8 -nocrypt -in key.pem`).                                   |
| `GITHUB_DISPATCH_INSTALLATION_ID` | Installation id of `nabatable-ci-dispatch` on the repository.                                   |
| `HEARTBEAT_TOKEN`                 | Bearer for `POST /heartbeat` (Mac controller only).                                             |
| `MONITORING_TOKEN`                | Bearer for `/ready` and for outbound readiness probes.                                          |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional Vercel automation bypass secret for a protected staging web deployment.                |
| `VERCEL_AUTOMATION_BYPASS_ORIGIN` | Exact HTTPS origin allowed to receive that secret, e.g. `https://nabatable-staging.vercel.app`. |
| `INCIDENT_ACKNOWLEDGEMENT_TOKEN`  | Bearer for incident acknowledgement; operator use only.                                         |
| `UPTIME_HEARTBEAT_URL`            | https URL pinged after a fully valid cycle.                                                     |

Incident acknowledgement requires a dedicated `INCIDENT_ACKNOWLEDGEMENT_TOKEN`, distinct
from readiness and heartbeat credentials. Missing, short, or placeholder values fail
closed; the monitoring token cannot authorize incident mutation. Provision this secret
through the approved operator process, never on the developer machine or local CI Mac.

Optional: `ERROR_INSIGHT_TOKEN`, `POSTHOG_PROJECT_API_KEY` (shared Worker
observability), `GITHUB_API_BASE_URL` (tests/GHES only).

GitHub App permissions: `nabatable-ci-dispatch` needs `actions:write` and read
access otherwise; `nabatable-local-ci` (Mac) needs `checks:write` plus read on
metadata, contents, pull requests and actions.

## Runbook

### Deploy

```bash
# Staging first, then production. Both refuse REPLACE_ME placeholders and
# verify /ready with MONITORING_TOKEN after upload.
pnpm deploy:validate-separation --env staging
pnpm deploy:workers --worker operational-control --env staging
pnpm deploy:workers --worker operational-control --env production
```

Rollback uses the `rollback:` command printed by `deploy:workers`
(`wrangler rollback` to the previous version id).

### Provisioning checklist (out of band, per environment)

1. Create the R2 bucket, record it in `wrangler.jsonc`, add the 14-day lifecycle rule.
2. Create the GitHub webhook on the repository pointing at
   `https://<worker-host>/github/webhook` with the events listed above and the
   `GITHUB_WEBHOOK_SECRET`.
3. Record the numeric ids for `REPOSITORY_ID`, `LOCAL_CI_APP_ID`,
   `GATE_WORKFLOW_ID`, `FALLBACK_WORKFLOW_ID`, `SCHEDULED_VALIDATION_WORKFLOW_ID`
   (`gh api repos/<owner>/<repo>/actions/workflows`).
4. Set every secret with `wrangler secret put … --env <env>`.
5. Replace the `REPLACE_ME_*_WORKERS_HOST` segments in `TARGETS_JSON`.
6. Confirm `GET /ready` returns `200` and the next cron cycle pings the uptime URL.

### Operate

- **Controller heartbeat stale**: `/ready` shows `controller.state` of `alert`
  (15 min) or `fallback_eligible` (60 min). Fallback is _eligible_, never
  automatic; a human dispatches `Hosted profile fallback`.
- **Incident escalated**: acknowledge with
  `curl -X POST -H "Authorization: Bearer $INCIDENT_ACKNOWLEDGEMENT_TOKEN" https://<host>/incidents/<id>/acknowledge`.
  Incidents resolve on their own after three healthy five-minute cycles.
- **Candidate failed**: `ci.gate.dispatch_failed` logs carry the candidate key
  and reason; evidence for the dispatch attempt lives under
  `evidence/<date>/dispatch/<candidateKey>.json`.
- **Uptime monitor alarms**: a missed ping means one of the cycle checks failed;
  read the latest `evidence/<date>/cycle/*.json` object for `invalidReasons`.

### Local development

```bash
pnpm --filter @nabatable/operational-control dev      # wrangler dev --local on :8790
pnpm --filter @nabatable/operational-control test
pnpm --filter @nabatable/operational-control verify   # lint, typecheck, coverage, dry-run build
```

Tests use `node:sqlite` as a stand-in for Durable Object SQLite storage and
fakes for R2, `fetch` and the GitHub API; no Miniflare or network access is
required.

## Layout

```
src/
  index.ts               routes, /ready, scheduled() entrypoint
  coordinator.ts         Durable Object: dedup, coalescing, retry queue, heartbeat, incidents
  coordinator-client.ts  typed client for the Durable Object stub
  github.ts              App JWT (RS256), installation token, readback, restricted dispatch
  gate.ts                readback-then-dispatch decision
  webhook.ts             payload validation and normalization
  signature.ts           HMAC-SHA256 over raw bytes
  heartbeat.ts           heartbeat contract
  readiness.ts           probes and the five-minute cycle
  evidence.ts            bounded, redacted R2 writes
  incidents.ts           pure incident state machine
  config.ts, contracts.ts, http.ts
tests/                   vitest (fakes only)
```

### Protected staging web probes

Keep Vercel Deployment Protection enabled. When a staging web readiness target is
protected, configure `VERCEL_AUTOMATION_BYPASS_SECRET` as a Worker secret and
`VERCEL_AUTOMATION_BYPASS_ORIGIN` as its exact HTTPS origin (no credentials, path,
query or fragment). Only staging targets matching that origin receive the
`x-vercel-protection-bypass` header; production and other origins do not. The
separate `MONITORING_TOKEN` bearer still authenticates the application readiness
endpoint. Redirects are not followed and neither headers nor provider error
messages enter probe reports, logs or stored cycle evidence.

These optional bindings do not enable the controller, workflow dispatch, or an
external alert provider. A paused controller still makes the complete monitoring
cycle invalid under the existing heartbeat freshness policy.

### Public Worker readiness routes

All operational-control environments enable `global_fetch_strictly_public` so
readiness requests to customer Workers, including same-account `workers.dev`
URLs, go through Cloudflare's public routing. This monitors the published endpoint
and preserves its authentication and edge protections. Without this flag,
same-zone global fetch can bypass the Worker mapped to the URL and reach its
origin instead. See Cloudflare's [fetch documentation](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
and [compatibility flag documentation](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).

The target list remains explicitly separated by environment. Probes still send the
monitoring bearer, use GET with a bounded timeout, and reject redirects. No service
binding bypasses the public route. Verify the deployed configuration and a fresh
stored monitoring cycle after release; local tests cannot establish Cloudflare's
live account routing.
