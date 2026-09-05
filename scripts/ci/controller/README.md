# Local CI controller (Mac)

`pnpm ci:controller` (`scripts/ci/controller/main.ts`) is the daemon that turns
GitHub state into CI request tuples, runs them one at a time through the
executor (`pnpm ci:executor`) in a disposable VM, and publishes the result as
the `Local CI / <profile>` check run. It is deliberately dependency-free at
runtime beyond `tsx`, `zod` (contracts) and Node built-ins (`node:sqlite`,
`node:crypto`, `fetch`).

## Modules

| Path                          | Responsibility                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `queue/`                      | Durable queue: dedup keys, attempt state machine, leases, publications, heartbeats; `node:sqlite` or in-memory backend         |
| `github/`                     | GitHub App client (RS256 JWT via `node:crypto`, installation tokens, ETags, pagination, rate-limit backoff), evidence document |
| `admission/`                  | Host probes (`pmset -g batt`, `memory_pressure`/`vm_stat`, `pmset -g therm`, `df -k`) and the fail-closed admission policy     |
| `controller.ts`               | Reconcile-on-start, poll loop, classification, dispatch, collection, publication, heartbeat                                    |
| `runner.ts`                   | Default runner: spawns the executor CLI and captures its JSON result                                                           |
| `heartbeat.ts`, `keychain.ts` | Heartbeat POST to the operational Worker; bearer token via `security find-generic-password`                                    |
| `caffeinate.ts`               | Sleep assertion (`caffeinate -i -s -w <pid>`) owned by the daemon                                                              |

Every external effect is injectable (fetch, spawn, exec, probes, clock,
runner), which is how `tests/scripts/ci/controller/**` exercises the daemon
without macOS, GitHub or a VM.

## Attempt state machine

```
queued -> leased -> running -> collected -> published
   \         \         \           \
    +---------+---------+-----------+--> failed | cancelled | superseded
```

`collected` is only entered with a complete `CiResult` (contracts
`CiResultSchema`) whose `dedupKey` and `attempt` match the dispatched tuple;
`published` is only reachable from `collected`. An interrupted attempt (lost
lease, restart, executor crash, unreadable stdout) therefore can never become a
success check: it is failed and re-queued up to `NABATABLE_CI_MAX_ATTEMPTS`,
after which the check is published as `failure` with the last reason.

## Scheduling

1. Current `main` head > ready PRs (FIFO) > nightly.
2. After two consecutive `main` executions a waiting PR is serviced first.
3. A newer head on the same PR supersedes older revisions: queued attempts are
   marked `superseded`; a running attempt receives the `cancel` stop signal, the
   runner sends `SIGTERM`, and whatever it produced is published as
   `cancelled`, never `success`.
4. Nightly is preemptible only at safe boundaries (the executor polls the
   control file between suites) and only when main/PR work is waiting.
5. Admission window changes (normal <-> dedicated) change the allocation of the
   _next_ job only; a running job is never interrupted by a window change.

## Admission (fail closed)

New jobs are deferred, never started, when any probe fails or reports: not on
AC power, free memory below the floor, thermal CPU speed limit below the floor,
or free disk below `disk.minFreeGiB` from `config/ci/operating-config.json`.
The dedicated window and nightly hour also come from that file (Europe/London,
DST-aware via `Intl`). The controller never stops containers or VMs it did not
start.

## Trust and classification

Pull requests are classified from list metadata only, before anything is
fetched: forks and foreign repositories are rejected outright, then the shared
trust policy (`config/ci/trust-policy.json`, contracts `classifyWithReason`)
decides whether the author may run locally. Automation identities, unknown
actors, drafts and PRs without a synthetic merge commit are skipped (they stay
on hosted CI). While `trustedRepositoryId` is still a placeholder, every PR is
routed hosted and only `main`/`nightly` run locally; `--check-config` reports
this.

## Executor contract

The runner writes `<state>/<attemptId>/request.json` containing exactly the
CI request tuple and runs `pnpm ci:executor --request @request.json --json`
from the release checkout (`cwd`). The executor's stdout is captured to
`executor.stdout.log` and parsed as the result document. Two side channels are
exported in the child's environment:

- `NABATABLE_CI_CONTROL_FILE` - `{"stop":"continue"|"preempt"|"cancel"}`, rewritten
  when the controller's stop signal changes; the executor should poll it
  between suites and exit with `supervisorOutcome: "cancelled"` when asked.
- `NABATABLE_CI_ALLOCATION_FILE` - `{"mode","allocation"}` for the admitted job.

## GitHub identity (fail closed)

The client refuses to be built with any App id other than the configured
`nabatable-local-ci` id, verifies `GET /app` (id and slug) and
`GET /repositories/<id>` (id, and `owner/repo` when configured) before any
repository call, and binds every check run to its tuple through `external_id`
(`nabatable-ci/v1:...`, the same key the release gate computes). The private
key is parsed into a closure-local `KeyObject`; `describe()`/`toJSON()` expose
identifiers only.

## Heartbeat

Every tick posts a flat JSON body to `NABATABLE_CI_HEARTBEAT_URL`
(`POST /heartbeat` on the operational Worker) with the bearer token read from
the Keychain item `NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN` (account
`NABATABLE_CI_KEYCHAIN_ACCOUNT`, both exported by `controller.sh`). Only the keys the Worker allow-lists
are sent (`controllerId`, `controllerVersion`, `imageDigest`, `activeRuntime`,
`candidateRuntime`, `status`, `sentAt`, `queueDepth`, `running`,
`maxConcurrent`, `lastCompletedAt`); the emitter refuses nested or
credential-shaped fields. Heartbeat failures are logged and never stop the
queue; a stale heartbeat is what makes the hosted fallback eligible.

## Configuration

Identifiers come from `~/nabatable-ci/config/controller.env` (template written
by `infra/local-ci/bin/install.sh`); `controller.sh` refuses to start while a
`REPLACE_ME` remains, and `main.ts` re-validates every value. Where two
spellings exist both are read and must agree.

| Variable                                                                                | Meaning                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NABATABLE_CI_GITHUB_APP_ID` (`NABATABLE_LOCAL_CI_APP_ID`)                              | GitHub App id of `nabatable-local-ci`                                         |
| `NABATABLE_CI_GITHUB_APP_INSTALLATION_ID` (`NABATABLE_LOCAL_CI_INSTALLATION_ID`)        | Installation id on the repository                                             |
| `NABATABLE_CI_GITHUB_REPOSITORY_ID` (`NABATABLE_CI_REPOSITORY_ID`)                      | Numeric repository id; verified against GitHub                                |
| `NABATABLE_CI_GITHUB_REPOSITORY` (`NABATABLE_CI_REPOSITORY`)                            | Optional `owner/repo`; must match the repository id                           |
| `NABATABLE_CI_JOB_IMAGE_DIGEST` (`NABATABLE_CI_IMAGE_DIGEST`), `NABATABLE_CI_JOB_IMAGE` | Tuple image digest; must match the digest pinned in the job image             |
| `NABATABLE_CI_POLICY_VERSION`                                                           | Optional; must equal the profile catalog's `POLICY_VERSION`                   |
| `NABATABLE_CI_KEYCHAIN_ACCOUNT`, `NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY`                 | Keychain account and item of the App PEM (defaults are the shared item names) |
| `NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH`                                                   | Optional 0600 PEM file used instead of the Keychain item                      |
| `NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN` (`NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE`)     | Keychain item of the heartbeat token                                          |
| `NABATABLE_CI_HEARTBEAT_URL`                                                            | https endpoint of the operational Worker                                      |
| `NABATABLE_CI_OPERATING_CONFIG`, `NABATABLE_CI_TRUST_POLICY`                            | Policy files, relative to the release checkout                                |
| `NABATABLE_CI_WORKSPACE`                                                                | Volume probed for free disk                                                   |
| `NABATABLE_CI_QUEUE_DB`, `NABATABLE_CI_STATE_DIR`                                       | SQLite queue and per-attempt executor state                                   |

`pnpm ci:controller --help` lists the defaults.

## Runtime qualification

The controller records `activeRuntime: node22` and `candidateRuntime: node24`
in its heartbeat and check summaries. Node 24 (production Vercel) becomes active
only after a reviewed qualification run of the local profiles; package engines
and workflow `node-version` are not flipped by this workstream.

## launchd usage assumptions

The plist and shell wrapper are owned by `infra/local-ci/` (see
`docs/runbooks/local-ci.md`). The controller assumes:

- It is started by `com.nabatable.ci-controller.plist` via
  `infra/local-ci/bin/controller.sh` as the standard (non-admin) service
  account `nabatable-ci`, with `KeepAlive` so a crash restarts it; startup is
  reconcile-first, so restarts are safe (stale leases are released and
  in-flight attempts are re-queued, never published).
- `controller.sh` loads `controller.env` (non-secret identifiers only), checks
  that the Keychain items exist without reading them, and exports their names
  (`NABATABLE_CI_KEYCHAIN_ACCOUNT`, `NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY`,
  `NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN`). The controller reads both secrets
  itself with `security find-generic-password -s <item> -a nabatable-ci -w`
  (the App key may be stored as PEM or single-line base64), so the login
  Keychain of that account must exist and be unlocked for the daemon session.
  A wrapper that prefers to materialise the key can instead export a 0600 file
  as `NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH`.
- `WorkingDirectory` is the reviewed release checkout
  (`~/nabatable-ci/current`); `config/ci/operating-config.json` and
  `config/ci/trust-policy.json` are resolved relative to it, and the executor
  is spawned from it.
- `SIGTERM` (launchd `ExitTimeOut`) starts a drain: no new dispatch, the running
  attempt is awaited, a `draining` heartbeat is sent, and the caffeinate child
  exits with the daemon.
- The daemon owns exactly one `caffeinate -i -s -w <pid>` child. This prevents
  idle sleep (and AC system sleep) but **not** lid-close sleep without an
  external display; the runbook documents the supported clamshell setup.
- Logs go to stdout/stderr as JSON lines (`StandardOutPath`/`StandardErrorPath`
  in the plist) and are redacted with the shared Worker redaction rules plus
  PEM/JWT/GitHub-token scrubbing.

`pnpm ci:controller --check-config` validates the environment and prints the
resolved configuration (identifiers only) without contacting GitHub or the
Keychain; `--once` performs one reconcile + tick and waits for the job, which
is the recommended smoke test after installation.
