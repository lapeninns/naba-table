# Local CI runbook

Operating guide for the Mac-hosted, VM-isolated CI runner. Configuration
lives under `infra/local-ci/`; controller and executor code live under
`scripts/ci/`. Scheduling policy (dedicated window, nightly start, disk caps,
retention, polling, heartbeat, fallback) is owned by
`config/ci/operating-config.json` (schema `scripts/ci/contracts/operating-config.ts`);
`infra/local-ci/operating.json` only describes the physical VM shape, is read
by the executor as its "operating facts", and points back at the policy file
with JSON pointers that the infra tests resolve.

## Architecture

```
GitHub (PR / main push)
   │  GitHub App "nabatable-local-ci" (checks:write; metadata/contents/PRs/actions read)
   ▼
Mac controller  (LaunchAgent in the nabatable-ci session, pnpm ci:controller)
   │  CI request tuple {repositoryId, profile, prNumber?, headSha, baseSha,
   │  testedSha, policyVersion, imageDigest, controllerVersion, attempt}
   ▼
Executor (pnpm ci:executor, one request)
   │  rejects unless imageDigest == job image digest and the golden disk's
   │  sha256 == NABATABLE_CI_BASE_IMAGE_DIGEST
   │  limactl create/start  nabatable-ci-<jobId>  (cold clone of the golden image,
   │  no mounts, only the dockerd unix socket forwarded; destroyed afterwards)
   ▼
Job container  (ci-registry.local/nabatable/ci-job@sha256:…: Node 22 + pnpm 10.34.5
   │  + Playwright 1.58.1 Chromium; --user 1000:1000; seccomp ci-job.json;
   │  internal network nabatable-ci-jobs; proxy only while egress phase == prep)
   ▼
Evidence bundle → R2 (creds from Keychain) → check "Local CI / <profile>"
```

The **golden image** is built once per reviewed release by
`infra/local-ci/bin/build-base-image.sh` from `infra/local-ci/lima/nabatable-ci.yaml`
(Ubuntu 24.04 arm64, Docker Engine pinned, internal job network, nftables
egress policy, tinyproxy, job image baked in) and exported as a digest-pinned
qcow2. Every request boots a fresh clone of it and deletes the clone when
done, so nothing (caches, image stores, firewall phase) survives between jobs.

Trust boundaries, from the outside in:

1. The host filesystem is never visible to the guest (`mounts: []`), and no
   guest port is forwarded back to the host. The host reaches a job instance
   only through Lima's SSH channel and the forwarded dockerd unix socket bound
   to the `nabatable-ci` Docker context (`default` is never used).
2. The guest has exactly one egress path, tinyproxy, with an exact-hostname
   allowlist and address-level denies for private/link-local/metadata/IPv6
   space (`infra/local-ci/network/README.md`). Jobs can reach only
   `10.90.0.1:8888`, only while the executor holds phase `prep`, and are
   never forwarded.
3. Jobs run as `1000:1000` with `--cap-drop=ALL`, `no-new-privileges`, the
   seccomp profile, `--ipc none`, and a read-only root filesystem.
4. Every input to a job is pinned: golden image by digest, Docker Engine by
   version, job image by RepoDigest, Playwright and pnpm by version, source
   by `testedSha` (verified with `git rev-parse HEAD` after checkout).
   Missing or placeholder values fail closed before any instance starts.

Runtime policy: the job image is `node22` (`activeRuntime`), matching hosted
workflows. `node24` is the `candidateRuntime` (production Vercel) and is only
built for the Phase 2 qualification runs below until a reviewed release flips
package engines and the workflow `node-version` together.

## Service account

By default, the controller runs as a dedicated standard (non-admin) macOS account,
`nabatable-ci`, home `/Users/nabatable-ci`. `bin/install.sh` prints the
`sysadminctl` command; it never creates the account itself. The account:

- owns the golden image (`~/nabatable-ci/images/`), the Lima instances
  (`~/.lima/nabatable-ci-*`), the Docker context, the release checkouts
  (`~/nabatable-ci/releases/<tag>`, `~/nabatable-ci/current` symlink), the
  spool and job roots, the private run directory (`~/nabatable-ci/run`, 0700)
  and the non-secret config (`~/nabatable-ci/config/controller.env`);
- has its own login Keychain holding the secrets listed below;
- must be a FileVault-enabled (secure token) user so it can unlock the disk
  after a cold boot, which also logs it in (see FileVault below);
- must be the account that runs `build-base-image.sh`: Lima names the guest
  user after the host user and the golden image bakes that user's docker
  group membership and `/home/ci/spool`.

The controller is a **LaunchAgent**, not a LaunchDaemon: it must run inside
the `nabatable-ci` login session because that is where the login Keychain is
unlocked, and Virtualization.framework VMs are supported from a user session.
The session may sit behind the lock screen or a fast-user-switch to an
operator account; agents keep running.

## Existing-user opt-in

The user may explicitly choose the existing non-root macOS login with `--current-user`. This is an accepted alternative to creating `nabatable-ci`; it does **not** provide a separate OS user boundary. Other processes running as that same user retain that user's filesystem and login-Keychain privileges. The dedicated-account installation above remains the default.

Current-user installation validates the owner UID and managed paths, rejects redirected asset directories, and requires an existing `current` symlink to a reviewed release under `$HOME/nabatable-ci/releases/`. The installer reads that release without cloning or modifying it. Keep release checkouts free of developer credentials, real `.env` files, and local modifications.

The current-user paths are:

| Setting                                | Fixed location                                                 |
| -------------------------------------- | -------------------------------------------------------------- |
| CI root (`0700`)                       | `$HOME/nabatable-ci`                                           |
| Lima instances (`LIMA_HOME`)           | `$HOME/nabatable-ci/lima`                                      |
| Docker configuration (`DOCKER_CONFIG`) | `$HOME/nabatable-ci/docker`                                    |
| Non-secret settings                    | `$HOME/nabatable-ci/config/controller.env`                     |
| Reviewed release                       | `$HOME/nabatable-ci/current` → `releases/<commit>`             |
| LaunchAgent                            | `$HOME/Library/LaunchAgents/com.nabatable.ci-controller.plist` |

The rendered LaunchAgent records `NABATABLE_CI_ACCOUNT_MODE=current-user` and `NABATABLE_CI_OWNER_UID` from the installing user's actual UID. The controller refuses root or a different UID. Its normal entry point re-executes with an empty ambient environment and an explicit Node 22 PATH before loading CI-only settings; personal credentials and `NODE_OPTIONS` are not inherited. It then forces the isolated Lima and Docker paths. Only the named CI App/evidence/heartbeat credentials belong in the CI runtime. Disposable job VMs still mount no host directories (`mounts: []`) and use the same sanitized test environment, network restrictions, and privilege limits as dedicated-account mode.

After preparing the reviewed release and `current` symlink, run these commands as the selected owner, without sudo:

```sh
export PATH="/opt/homebrew/opt/node@22/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
sh infra/local-ci/bin/build-base-image.sh --current-user --mode normal --plan
sh infra/local-ci/bin/install.sh --current-user --no-start
```

The image builder also requires `--current-user`; omit `--plan` to perform the reviewed build. Stage the controller with `--no-start` while image qualification, CI credentials, and configuration are incomplete. In current-user mode that flag writes both `RunAtLoad=false` and `KeepAlive=false` and skips bootstrap/kickstart, so a future login does not start the staged agent. It leaves an already loaded agent unchanged. After qualification and configuration checks pass, rerun `install.sh --current-user` to activate it. A VM boot or successful image build alone is not qualification.

Current-user removal uses `sh infra/local-ci/bin/uninstall.sh --current-user [--delete-vm] [--delete-config]`. It removes only this user's CI LaunchAgent and the `nabatable-ci` context in the isolated Docker directory. VM deletion is opt-in and limited to CI-named instances inside the isolated Lima directory; config deletion is also opt-in. Release checkouts, materialized credential files, and Keychain items remain unchanged. Personal Docker contexts and personal Lima instances are outside these operations.

## Keychain items

All four are generic passwords in the selected CI owner's login Keychain with
**service = item name** and **account = `nabatable-ci`**
(`NABATABLE_CI_KEYCHAIN_ACCOUNT`, the controller's and executor's default).
`controller.sh` checks that each exists and refuses to start otherwise; the
value is read only by the component that needs it.

| Item (service)                                           | Content                                                                | Read by                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `nabatable-ci/github-app/nabatable-local-ci/private-key` | GitHub App PEM, verbatim or single-line base64                         | `controller.sh` → 0600 file → `NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH`       |
| `nabatable-ci/monitoring/heartbeat-token`                | bearer token for the controller heartbeat (`ops:verify`)               | `scripts/ci/controller` via `NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE`     |
| `nabatable-ci/r2/evidence/access-key-id`                 | R2 access key id (evidence bucket, approved Object Read & Write token) | `scripts/ci/executor/r2/credentials.ts` (item name from `operating.json`) |
| `nabatable-ci/r2/evidence/secret-access-key`             | R2 secret access key                                                   | `scripts/ci/executor/r2/credentials.ts` (item name from `operating.json`) |

Create them with `security add-generic-password -s '<item>' -a nabatable-ci -w`
as the selected CI owner; the value is prompted, never passed on a command line. In current-user mode the macOS login is your existing user, but the Keychain item account field remains `nabatable-ci`.
The prompt takes one line, so for the PEM run `base64 < key.pem | pbcopy` and
paste. Rotation is the same command with `-U`. The App key is the one item the
controller reads as a file: `controller.sh` copies it from the Keychain into
`~/nabatable-ci/run/github-app.pem` (dir 0700, file 0600, umask 077, never
echoed) on every start and exports the path. Dedicated-account uninstall removes this materialized file; current-user uninstall leaves credential files unchanged.
The heartbeat item name and account are also the controller's compiled-in
defaults, so an unset variable can never point at a different entry.

### Approved R2 evidence permission exception

On 2026-09-05 the owner approved Cloudflare's persistent **Object Read & Write** token, scoped only to `nabatable-ci-evidence`, expiring on 2026-10-05. Cloudflare's persistent S3 credentials do not offer a write-only object permission, and the uploader verifies each PUT with a signed HEAD. This scope also allows object reads, lists, and deletion within that bucket; it grants no access to the separate operational evidence or backup buckets. Do not describe it as write-only.

The access key and secret remain in the two named login-Keychain items above. Renew or replace the credential before expiry through the operator process. Changing the bucket scope, duration, or permissions requires a separate review. This exception applies only to local CI evidence; it does not amend backup credential separation or permit deployment credentials on the Mac.

A 70-byte non-sensitive object was uploaded with the repository uploader and verified by signed HEAD on 2026-09-05. This proves storage access only; it does not qualify the runner's complete CI profile or authorize its image digest in the release policy.

Non-secret IDs (App ID, installation ID, repository, repository ID, source
URL, policy version, golden image path/digest, job image reference and its
digest, R2 endpoint and bucket, heartbeat URL, spool/job roots, VM mode) go
in `controller.env`. The template written by `install.sh` uses `REPLACE_ME_*`
placeholders and `controller.sh` refuses to start while any remain or while
any line looks like a secret. VM resources are not in `controller.env`:
`controller.sh` resolves `NABATABLE_CI_VM_MODE` through `bin/vm-mode.sh` from
`infra/local-ci/operating.json` (the single source for 6/16GiB and 10/24GiB).

`NABATABLE_CI_IMAGE_DIGEST` is stamped into every request tuple as
`imageDigest` by the controller and must be the job image digest (the sha256
in `NABATABLE_CI_JOB_IMAGE`); the executor rejects a request whose digest
differs from the image it runs, before any instance is created.
`NABATABLE_CI_BASE_IMAGE_DIGEST` is the golden disk digest and is verified by
the executor against the file on disk before every clone.
`build-base-image.sh` prints all of them.

## Install

The following steps describe the default dedicated-account installation. For the existing login, use the explicit current-user procedure above.

Prerequisites: macOS 14+ on Apple silicon, `brew install lima docker qemu node@22`
(Docker CLI only; Docker Desktop is optional and untouched; `qemu-img` for
the golden export), AC power, 100GiB free disk.

1. In a reviewed release, verify the pinned versions in
   `infra/local-ci/lima/nabatable-ci.yaml` (Ubuntu release date + sha256
   digest, `docker-ce` apt version). `bin/preflight.sh` fails if configuration fields contain placeholders.
2. As `nabatable-ci`, install the pinned package-manager shim in that account's own directory:

   ```sh
   export PATH="/opt/homebrew/opt/node@22/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
   mkdir -p "$HOME/.local/bin"
   corepack enable --install-directory "$HOME/.local/bin"
   corepack prepare pnpm@10.34.5 --activate
   node --version
   pnpm --version
   ```

   The LaunchAgent wrapper puts Homebrew's Node 22 and this account-local shim ahead of other runtimes. It does not depend on a developer's nvm installation.

   Then, with `NABATABLE_CI_NODE_IMAGE_DIGEST` (node:22-bookworm-slim
   arm64) and `NABATABLE_CI_REGISTRY_IMAGE_DIGEST` (registry:2 arm64) exported:
   `infra/local-ci/bin/build-base-image.sh --mode normal` (preview with
   `--plan`). It creates `nabatable-ci-golden`, runs `sync-vm-config.sh`
   (job network, proxy, egress policy in phase `test`), builds the job image
   inside the guest through the restricted job proxy, exports
   `~/nabatable-ci/images/nabatable-ci-golden-<stamp>.qcow2`, and prints the
   `NABATABLE_CI_BASE_IMAGE_*`, `NABATABLE_CI_JOB_IMAGE` and
   `NABATABLE_CI_IMAGE_DIGEST` lines for `controller.env`.

3. As an administrator: `sudo infra/local-ci/bin/install.sh`. It runs
   preflight under the service account with the controller PATH, creates the `nabatable-ci` Docker context (unbound until a job
   starts), writes the config template, installs
   `~nabatable-ci/Library/LaunchAgents/com.nabatable.ci-controller.plist` and
   bootstraps it into `gui/<uid>` if the account is logged in (otherwise it
   loads at that account's next login). Re-running is safe; it kickstarts the
   agent after a release update.
4. As `nabatable-ci`: fill in `~/nabatable-ci/config/controller.env`, create
   the Keychain items, then run the post-install smoke test from
   `~/nabatable-ci/current`: `pnpm ci:controller --check-config` (validates
   the controller.env/Keychain contract and prints identifiers only), then
   `pnpm ci:controller --once` (one reconcile + poll tick, no daemon), then
   `pnpm ci:executor --dry-run` to see the exact plan for one request.
   Contract checks enforced by `--check-config`:
   - `NABATABLE_CI_POLICY_VERSION`, when set in `controller.env`, must equal
     `POLICY_VERSION` in `scripts/ci/profiles/catalog.ts` (currently
     `2026-09-04.1`); the controller refuses to start otherwise.
   - `NABATABLE_CI_JOB_IMAGE_DIGEST` must equal the digest pinned in
     `NABATABLE_CI_JOB_IMAGE`; a mismatch refuses to start.
   - `config/ci/trust-policy.json` must carry the numeric
     `trustedRepositoryId` and the human logins in `actorPolicy.localActors`
     before any pull request runs locally. Until then `--check-config`
     reports `trustPolicy.configured: false`, every PR is routed to hosted
     CI and only `main`/`nightly` run on the Mac.
   - The Keychain item
     `nabatable-ci/github-app/nabatable-local-ci/private-key` may hold the
     PEM verbatim or as single-line base64; the controller decodes either.
   - `node:sqlite` (Node 22.13+) is required for the controller's queue
     store; the controller runs on macOS only.
5. Confirm: `launchctl print gui/$(id -u nabatable-ci)/com.nabatable.ci-controller`
   shows the process running and `~/Library/Logs/nabatable-ci/controller.err.log`
   is quiet. The heartbeat should appear in the monitoring dashboard within
   one `ops:verify` cycle.

## Uninstall

`sudo infra/local-ci/bin/uninstall.sh [--delete-vm] [--delete-config]`
unloads the agent, removes the plist, removes the materialised App key file
and only the `nabatable-ci` Docker context. Containers are never stopped by
the script; the golden instance and any leftover `nabatable-ci-*` job
instances are deleted only with `--delete-vm`. Keychain items are listed for
manual deletion, and the GitHub App installation and R2 token must be
revoked in their consoles.

## Lid, display, and sleep

- Supported: lid open, or clamshell mode with **AC power and an external
  display** (macOS requires both to stay awake with the lid closed).
- Not supported: closed lid without an external display. macOS sleeps
  regardless of `pmset` settings; the VM is suspended mid-job and the
  request fails its deadline. `caffeinate -s` only prevents system sleep on
  AC for an open-lid machine; it does not prevent lid-close sleep.
- The controller holds `caffeinate -i -s -w <pid>` for its whole lifetime
  (started after reconcile-on-start, released on drain) so the system does
  not idle-sleep mid-job. `bin/preflight.sh` warns when AC sleep is enabled;
  `sudo pmset -c sleep 0 disksleep 0` is the recommended dedicated-Mac
  setting.
- Battery: the controller refuses to schedule on battery power and pauses
  the queue until AC returns (preflight FAILs without AC).

## FileVault and cold reboot

In current-user mode, the selected existing login must be unlocked and have a GUI session before its activated agent can run. A staged `--no-start` agent remains stopped. The remaining instructions in this section describe the default dedicated account.

With FileVault on, the disk is locked until a FileVault-enabled user
authenticates at the pre-boot unlock screen, and macOS then logs that user in
(pass-through login). Unlock with the **`nabatable-ci`** account: its session
starts, its login Keychain is unlocked, and launchd loads the agent
(`RunAtLoad`). Then fast-user-switch to your own account; the `nabatable-ci`
session and its agent keep running. If another account unlocked the disk,
log in as `nabatable-ci` once (fast user switching) so the session exists.

Until then the controller heartbeat is absent: `ops:verify` flags the runner
as stale after `heartbeat.alertAfterMinutes` and, after
`fallback.eligibilityAfterMinutes`, the dispatch worker uses the hosted
fallback workflow (`Hosted profile fallback`). Nothing is lost: pending
requests are re-driven from GitHub state when the controller reconciles.

## VPN changes

Guest egress goes through tinyproxy and then the host's routing table, so a
VPN on the host changes which network the proxy exits through but not what
the guest can reach: the allowlist and address denies are enforced inside
the guest. Operationally:

- Full-tunnel VPNs that block local NAT will make the proxy time out; the
  `prepare` step fails, the request is reported as `error`, and the
  controller re-queues it with `attempt + 1` up to the policy limit (no
  silent pass).
- Split-tunnel VPNs are fine. Do not add VPN-internal hosts to the
  allowlist; the guest deliberately cannot reach RFC1918/CGNAT space.
- `bin/preflight.sh` reports connected VPN configurations and `utun`
  interfaces so the operator knows the exit path changed.

## Sleep and network interruptions

- If the Mac sleeps or loses network during a job, the executor's step or
  profile deadline expires and the request is reported as `error` (never
  `success`), with whatever evidence was staged uploaded when possible. The
  instance is destroyed in `finally`; a destroy failure is attached to the
  result so leaks are visible.
- The controller heartbeat stops during sleep; `ops:verify` flags the runner
  as stale after the configured interval and the dispatch worker uses the
  hosted fallback for new requests.
- There is no VM to pause outside the dedicated window: instances exist only
  for the duration of a request. The window only changes the resource mode
  (`dedicated` inside, `normal` outside). `ExitTimeOut` 120s gives the
  executor time to abort a running job and destroy its instance on
  controller shutdown.

## Qualification scenarios

Run before enabling the runner for required checks and after any change to
the files under `infra/local-ci/`. Record results as evidence in the release
PR.

### Phase 2: isolation and correctness

1. Job cannot see the host: `ls /Users` and `mount | grep -c virtiofs` inside
   a job return nothing / `0`; `limactl shell nabatable-ci-<jobId> -- mount`
   shows no host mounts.
2. No port forwards: from the host, `lsof -nP -iTCP -sTCP:LISTEN` shows no
   Lima-forwarded guest TCP ports; only the dockerd unix socket under
   `~/.lima/nabatable-ci-<jobId>/sock/` exists.
3. Egress in phase `prep`: `curl -x http://10.90.0.1:8888 https://registry.npmjs.org/`
   succeeds; `curl -x ... http://169.254.169.254/`, `https://example.com/`
   (not allowlisted), a host that resolves to an RFC1918 address, and any
   IPv6 target are refused; `getent hosts registry.npmjs.org` fails. This
   also proves the pinned Docker Engine lets an `--internal` network reach
   its own gateway address (see the known risk in `network/README.md`).
4. Egress in phase `test`: every request from the job fails with a
   connection error, including to the proxy; `sudo -n egress.sh status`
   reports `phase: test`; with the ruleset flushed it reports
   `phase: unknown` and the executor aborts the job.
5. Seccomp: `unshare -r`, `mount -t tmpfs none /mnt`, `strace true`, and a
   `keyctl` call all fail with `EPERM`; Node, git, pnpm and Chromium (with
   `chromiumSandbox: false`) work.
6. Non-root: `id -u` is `1000`; `sudo` is absent; writing outside
   `/workspace`, `/home/ci` and `/tmp` fails (read-only root); `/tmp` is `noexec`.
   The job home and pnpm store use a separate disposable volume at `/home/ci`,
   keeping dependency caches outside source scans in `/workspace`.
7. Pinning: a request with an `imageDigest` different from the job image
   digest, a golden file whose sha256 differs from
   `NABATABLE_CI_BASE_IMAGE_DIGEST`, a placeholder anywhere in
   `controller.env` or `operating.json`, an unknown `policyVersion`, or a
   wrong `repositoryId` is rejected before any instance is created
   (`pnpm ci:executor --dry-run` shows `REQUEST REJECTED` / `UNCONFIGURED`).
8. Disposability: after a request, `limactl list` shows no
   `nabatable-ci-<jobId>`, `docker context inspect nabatable-ci` points at a
   socket that no longer exists, and a fresh clone boots in phase `test`
   with the job network present and the job image already loaded.
9. Evidence: the bundle for a synthetic failing test lands in R2 and the
   check run shows `failure` with the summary; a bundle upload failure marks
   the check `error`, not `success`.
10. Runtime candidate: the same list passes with the `node24` job image
    before `candidateRuntime` may be promoted.

### Phase 3: operations

1. Cold reboot with FileVault: after unlocking as `nabatable-ci`, the agent
   starts within 60s and the heartbeat resumes; a request completes end to
   end.
2. Lid closed with AC + external display: a 20-minute job completes.
3. Lid closed without external display: job fails with a deadline error,
   is retried after wake, and the check never reports a false `success`.
4. Battery: unplugging pauses the queue; replugging resumes it.
5. VPN connect/disconnect mid-job: job fails or completes, never hangs past
   the deadline; the next job succeeds.
6. Network loss for 5 minutes: heartbeat goes stale, `ops:verify` alerts, the
   hosted fallback runs, the runner recovers without operator action.
7. Dedicated window edge: a request started inside the window with mode
   `dedicated` finishes or is cleanly aborted; the next request outside the
   window uses mode `normal`.
8. Update: rolling `current` to a new release tag and re-running
   `install.sh` kickstarts the agent; rolling back the symlink restores the
   previous behaviour.
9. Uninstall/reinstall leaves Docker Desktop's default context and any user
   containers untouched (`docker context ls`, `docker ps` before/after).
10. Disk pressure: with less than `disk.minFreeGiB` free the controller
    refuses new leases and preflight FAILs.

## Updates

The controller only ever runs code from a reviewed release checkout. The steps below use the default dedicated account; current-user installations perform release preparation as the existing owner and rerun `install.sh --current-user` (or `--no-start` while staging), without sudo. Rebuild with `build-base-image.sh --current-user` to retain the isolated Lima home.

Dedicated-account update steps:

1. Release Please tags a release on `main`.
2. As `nabatable-ci`: `git -C ~/nabatable-ci/releases clone --branch <tag> --depth 1 <repo> <tag>`
   then `corepack enable && pnpm install --frozen-lockfile` inside it.
3. Verify the tag signature/commit against the GitHub release page, then
   switch the symlink: `ln -sfn ~/nabatable-ci/releases/<tag> ~/nabatable-ci/current`.
4. `sudo infra/local-ci/bin/install.sh` (from the new checkout) re-applies the
   plist if changed and kickstarts the agent. If anything under
   `infra/local-ci/lima`, `infra/local-ci/seccomp`, `infra/local-ci/network`
   or `infra/local-ci/images` changed, rebuild the golden image with
   `build-base-image.sh` and update the digest lines in `controller.env`.
5. Keep the previous release directory and golden image until the new ones
   have completed one full dedicated window; roll back by moving the symlink
   and restoring the previous `controller.env` lines.

Never run the controller from a working tree with local modifications, and
never `git pull` inside a release directory.

### Private source acquisition

The executor uses the configured local CI App and installation IDs (the same
`NABATABLE_CI_GITHUB_*` / `NABATABLE_LOCAL_CI_*` aliases as the controller) and
its owner's named Keychain App key to fetch the private repository. Conflicting
identity aliases fail before Keychain or network access. Each fetch receives a
fresh installation token narrowed to the configured repository ID and
`contents: read`. GitHub App, installation, repository name/ID, returned token
permissions and expiry are verified before Git receives it.

The token enters only the host Git fetch environment as a URL-scoped HTTP header;
redirects are disabled. It is never placed in command arguments, Git config files,
bundles or guest environments. The executor revokes it after each fetch, including
failure, and refuses if revocation fails. Authentication errors omit provider and
Git diagnostics. The source remote must be a canonical
`https://github.com/OWNER/REPOSITORY.git` URL. Source authentication does not
register an Actions runner or replace the Release gate.
