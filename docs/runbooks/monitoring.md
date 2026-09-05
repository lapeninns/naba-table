# Monitoring runbook

Owner: platform-engineering. Contract: `config/observability/monitoring.yaml`. Verifier: `pnpm ops:verify` (`scripts/monitoring/verify.ts`). Evidence: `pnpm ops:slo-evidence` (`scripts/observability/slo-evidence.ts`).

## Three sources of truth

Monitoring is only trustworthy when three independent sources agree. Each source can fail on its own without hiding the others.

| Source              | What it proves                                                                                                                                                                                          | Cadence                           | Where it runs                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| External probes     | The public edge answers. UptimeRobot hits `/api/health` (web) and `/health` (Workers) unauthenticated, plus authenticated `/api/ready` and `/ready` with the monitoring token.                          | 5 minutes                         | UptimeRobot (free plan)                                                 |
| Hosted verification | Dependencies are ready, evidence is fresh, and the control plane is configured. `pnpm ops:verify` probes every target, checks backup/drill evidence age, required workflow files, required checks.      | Hourly                            | GitHub Actions `operational-verification.yml`, environment `Monitoring` |
| Heartbeat           | The hosted verifier itself is alive. `ops:verify` pings the UptimeRobot heartbeat URL **only after a fully valid cycle**; a missed heartbeat means the verifier failed, was disabled, or found a fault. | Expected hourly; grace 75 minutes | UptimeRobot heartbeat monitor                                           |

Readiness endpoints never mutate anything. The web route runs a bounded `select` on `restaurants`, a read-only storage bucket list, and a `HEAD` on the email gateway `/health`. Workers run `select 1` on D1, a KV `get` of `readiness:sentinel`, a queue-binding presence check, and a read-only Durable Object ping. A Durable Object ping proves the object is reachable and routing: any answer below 500 (including a 404 from an object that has no `GET /health` route, such as `CapacityVersionState`) counts as `ok`, a 5xx counts as `down`. Every check has a 1.5–2 s bound and reports `degraded` on timeout instead of hanging.

## Targets

| Target                     | Service               | Ready URL                                         | Config source                                                                                                                                                                                                               |
| -------------------------- | --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web                        | `nabatable-web`       | `https://app.nabatable.com/api/ready`             | `baseUrl`; override `MONITORING_WEB_BASE_URL`                                                                                                                                                                               |
| booking-short-links        | `booking-short-links` | `https://go.nabatable.com/ready`                  | `baseUrl`; override `MONITORING_BOOKING_SHORT_LINKS_BASE_URL`                                                                                                                                                               |
| email-queue-gateway        | `email-queue-gateway` | `<MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL>/ready` | env only; verification fails closed (`unconfigured`) until the secret is set                                                                                                                                                |
| sms-summary-gateway        | `sms-summary-gateway` | `https://nabatable-sms-summary-gateway.…/ready`   | `baseUrl`; override `MONITORING_SMS_SUMMARY_GATEWAY_BASE_URL`                                                                                                                                                               |
| operational-control-worker | `operational-control` | `<MONITORING_OPERATIONAL_CONTROL_BASE_URL>/ready` | env only; verification fails closed (`unconfigured`) until the variable is set. The control-plane `/ready` reports `checks` as a keyed map (`coordinator`, `evidenceBucket`, each with `ok`), which the verifier normalizes |
| operational-control        | GitHub control plane  | GitHub REST API                                   | backup/drill workflow runs, required workflow files, required status checks                                                                                                                                                 |

Thresholds for queue age, DLQ depth, latency, and failure rate are **not** duplicated in `monitoring.yaml`; each entry references an `alerts.yaml` key by `alertRef` and `ops:verify` fails when a reference does not resolve.

## UptimeRobot setup (free plan)

1. Create an account with the platform-engineering shared mailbox. The free plan supports 50 monitors at a 5-minute interval, email alerts, and heartbeat monitors.
2. Add **HTTP(s) monitors** (interval 5 min, timeout 30 s) for:
   - `https://app.nabatable.com/api/health` — expect 200.
   - `https://go.nabatable.com/health` — expect 200.
   - the email gateway and SMS gateway `/health` URLs — expect 200.
3. Add **keyword/HTTP monitors with custom headers** for the authenticated readiness endpoints. Set header `Authorization: Bearer <MONITORING_TOKEN>` (paste the value from the password manager; never commit it). Expect 200 and keyword `"status":"ok"`. A 503 response means at least one dependency reported `down`.
4. Add a **heartbeat monitor** named `nabatable ops:verify` with an expected interval of 60 minutes and a grace period of 15 minutes (75 minutes total, matching `heartbeat.graceMinutes`). Copy the generated heartbeat URL into the `MONITORING_HEARTBEAT_URL` secret of the GitHub `Monitoring` environment.
5. Configure **email alert contacts** for the on-call rota and enable "alert when down" and "alert when up" so recovery is recorded.
6. Do not create monitors that POST to any route. Monitors must only ever `GET`/`HEAD`.

## Monitoring environment secrets (GitHub environment `Monitoring`)

| Secret / variable                         | Purpose                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONITORING_TOKEN`                        | Bearer token accepted by `/api/ready` and Worker `/ready`. Minimum 32 characters. Also set on Vercel and as a Wrangler secret on each Worker.      |
| `MONITORING_GITHUB_TOKEN`                 | Fine-grained token, this repository only, `actions: read` and `administration: read` (for branch protection).                                      |
| `MONITORING_HEARTBEAT_URL`                | UptimeRobot heartbeat URL. Treated as a secret; never printed.                                                                                     |
| `MONITORING_EMAIL_QUEUE_GATEWAY_BASE_URL` | `https://` origin of the email queue gateway Worker.                                                                                               |
| `MONITORING_OPERATIONAL_CONTROL_BASE_URL` | `https://` origin of the operational-control Worker (no committed hostname). Unset means the control plane cannot be verified and the cycle fails. |
| `MONITORING_*_BASE_URL` (optional)        | Overrides for the other targets, e.g. when probing staging.                                                                                        |

The operational-control Worker accepts incident acknowledgement only with the separate `INCIDENT_ACKNOWLEDGEMENT_TOKEN` secret. Provision it for incident operators; do not put it in readiness monitors or the `Monitoring` workflow. A missing or placeholder token refuses acknowledgement. Rotate it independently on the Worker and in the operator password manager.

Rotate `MONITORING_TOKEN` by setting the new value on Vercel and every Worker first, then in UptimeRobot headers, then in the `Monitoring` environment. The endpoints accept exactly one token, so rotate in a maintenance window or accept one failed cycle.

## Running the verifier

```bash
pnpm ops:verify                 # full cycle, prints redacted JSON, exits 1 on any failure, 2 on config errors
pnpm ops:verify --skip-heartbeat # local dry run without touching the heartbeat monitor
```

The summary lists each target with `status`, `httpStatus`, `latencyMs`, `revision`, `deploymentId`, and per-check statuses, the backup/drill evidence freshness (`fresh` / `warning` / `stale` / `missing` / `unknown`), missing workflow files, missing alert references, the required-checks audit, and whether a heartbeat was sent. It never prints URLs, headers, or tokens.

Failure classes (all exit non-zero, no heartbeat):

- `MONITORING_TOKEN is not configured` — the verifier refuses to run unauthenticated.
- `target <name> readiness unauthorized` — token mismatch between the environment and the service.
- `target <name> readiness unconfigured` — no `https://` base URL resolved for the target.
- `target <name> readiness down|timeout|error|invalid` — dependency failure or a response that does not match the readiness contract (wrong `service`, missing `checks`).
- `backup evidence is stale|missing|unknown` — last successful backup run older than 24 h (warning at 18 h).
- `drill evidence is stale|missing|unknown` — last successful recovery drill older than 30 days (warning at 21 days).
- `required workflow file missing` / `threshold references unknown alert` — control-plane configuration drift.
- `required checks missing|could not be read` — branch protection does not enforce the release gate (`requiredChecks.enforce: true` fails closed).

`degraded` targets and evidence within the warning band produce warnings; the cycle still counts as valid and the heartbeat is sent, so degraded states surface through the readiness monitors rather than through a missed heartbeat.

## Alert verification steps

Run these after any change to monitors, tokens, or the verifier, and quarterly as part of the recovery drill.

1. **Token rejection**: `curl -si https://app.nabatable.com/api/ready` (no header) must return `401` with body `{"error":"Unauthorized"}` and `cache-control: no-store`. Repeat with a wrong token.
2. **Ready contract**: with the correct bearer, confirm `service`, `revision`, `deploymentId`, and a `checks` array containing `database`, `storage`, and `email-gateway`. `revision` must equal the deployed commit SHA.
3. **Worker contract**: for each Worker, `GET /ready` with the bearer returns its service name and check list (`d1`/`kv-cache`, `email-queue-state`/`capacity-version-state`, `daily-summary-queue`/`daily-summary-state`). `GET /health` stays unauthenticated and unchanged.
4. **Heartbeat gating**: run `pnpm ops:verify` with `MONITORING_GITHUB_TOKEN` unset; the output must show `"ok": false` and `"heartbeat": { "sent": false }`. UptimeRobot must alert after the grace period.
5. **Synthetic outage**: pause a Worker in Cloudflare (staging only) and confirm the external monitor alerts within two intervals and that `ops:verify` reports `down`.
6. **Evidence staleness**: temporarily point `evidence.backup.workflowFile` at a non-existent workflow in a local copy of the config and run `pnpm ops:verify --config <copy>`; expect `backup evidence is missing`.
7. **SLO evidence**: run `pnpm ops:slo-evidence --metrics <export.json> --probes <probes.json> --warm-up-started-at <ISO>` and confirm services report `unknown` until 14 days of warm-up and a full 30-day window at ≥ 99 % coverage exist. Attainment is only computed from complete request metrics, never from sampled error events.

## Acknowledgement flow

Incidents are deduplicated by `(service, environment, failureClass)` in `lib/observability/incidents.ts`; the error-insight webhook forwards at most 10 updates per incident to the GitHub issue and then counts further occurrences locally (`incident_action: suppressed`).

**Durable incident state.** The webhook stores global operational lifecycle snapshots in `public.operational_incidents` through service-role-only read and compare-and-swap RPCs. Atomic version checks preserve counts and ensure concurrent receivers cannot both claim an opening or escalation. Request paths are hashed before persistence; no guest payload is stored. Apply `20260905113000_durable_operational_incidents.sql` through the staging-first `pnpm db:*` promotion process before deploying the receiver. If storage is unavailable or contention exceeds the bounded retry budget, the route returns a generic `503` and does not dispatch; there is no process-local fallback. Resolved snapshots retain their version to prevent stale writers reopening old state.

GitHub dispatch is a separate network operation after the state commit. This change does not provide a transactional delivery outbox; a dispatch failure returns `502` and requires operational follow-up. Database RPC execution, privileges, and concurrency must be verified against staging before promotion.

1. UptimeRobot email or a GitHub `[automated error]` issue arrives. Open the linked runbook (`service-degradation.md` or `worker-degradation.md`).
2. **Acknowledge within 15 minutes** for `severity: critical` by assigning yourself to the GitHub issue and commenting `ack`. Unacknowledged critical incidents escalate (`incident_action: escalated`) and the issue receives an escalation comment; the on-call lead is paged by email.
3. Record the owner in the issue. The incident `owner`/`acknowledgedBy` fields mirror the assignee.
4. Fix or mitigate. The incident resolves automatically after **3 consecutive healthy observations**; do not close the issue by hand before that unless the alert was a false positive (document why).
5. If the alert was noise, adjust the threshold in `alerts.yaml` from measured baselines and reference it from `monitoring.yaml`; never silence a monitor.

## Runtime

`monitoring.yaml` records `activeRuntime: node22` and `candidateRuntime: node24`. Hosted workflows stay on Node 22 until one full 30-day evidence window under Node 24 passes with ≥ 99 % coverage and no runtime-attributed failures; only then does the integration owner flip the workflow runtime.
