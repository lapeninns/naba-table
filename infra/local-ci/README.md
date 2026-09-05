# Local CI infrastructure

Configuration for the Mac-hosted, VM-isolated CI runner described in
`docs/runbooks/local-ci.md`. Nothing here contains credentials. The Ubuntu image and Docker Engine inputs
are pinned for qualification; installation-specific IDs and generated image
digests still use `REPLACE_ME_*` placeholders that the scripts refuse to use.
See `docs/ci/mac-runner-preparation.md` for preparation evidence and remaining setup.

The executor (`scripts/ci/executor`) clones a **disposable Lima instance per
request** from a golden base image and destroys it afterwards. The files here
build that golden image and install the Mac-side controller.

The dedicated `nabatable-ci` macOS account remains the default. An explicitly authorized existing non-root login can use `bin/install.sh --current-user --no-start`, `bin/build-base-image.sh --current-user`, and `bin/uninstall.sh --current-user`. The installer requires an existing reviewed `current` release symlink and does not clone source. `--no-start` disables `RunAtLoad` and `KeepAlive` and skips startup; it does not stop an already running agent.

Current-user mode provides **no separate macOS user boundary**. The controller clears ambient environment before loading CI-only settings and credentials. Its private `0700` root is `$HOME/nabatable-ci`, with isolated `LIMA_HOME=$HOME/nabatable-ci/lima` and `DOCKER_CONFIG=$HOME/nabatable-ci/docker`; personal instances and contexts are untouched. CI checkouts must contain no real credentials or `.env` files. Job VMs retain no host mounts, a sanitized test environment, and the existing network and privilege restrictions. See the [current-user runbook](../../docs/runbooks/local-ci.md#existing-user-opt-in) for ownership, Keychain, staging, and removal details.

Current preparation is **in progress**: the real golden VM build is running, and successful image and end-to-end qualification have not yet been established. Do not activate the controller from build progress alone.

| Path                                        | What                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `lima/nabatable-ci.yaml`                    | Golden Lima VZ template (Ubuntu 24.04 arm64, no mounts, no port forwards)              |
| `bin/render-lima.sh`                        | Renders the `normal` / `dedicated` resource modes from the template                    |
| `bin/vm-mode.sh`                            | Resolves a mode to `NABATABLE_CI_LIMA_*` values (single source: `operating.json`)      |
| `bin/build-base-image.sh`                   | Builds, configures, bakes the job image into, and exports the golden image (`--plan`)  |
| `bin/sync-vm-config.sh`                     | Pushes seccomp/network config into the golden instance                                 |
| `images/ci-job/Dockerfile`                  | Job image: Node 22, pnpm 10.34.5, Playwright 1.58.1 Chromium deps, user `ci` 1000:1000 |
| `images/README.md`                          | Layers, local registry alias, seed cache key, disposable overlays                      |
| `seccomp/ci-job.json`                       | Docker seccomp profile with the extra denies                                           |
| `network/`                                  | nftables egress policy, tinyproxy config, allowlist                                    |
| `launchd/com.nabatable.ci-controller.plist` | LaunchAgent for the controller (service account `nabatable-ci`)                        |
| `bin/controller.sh`                         | launchd wrapper that resolves config/Keychain and execs `pnpm ci:controller`           |
| `bin/install.sh` / `bin/uninstall.sh`       | Idempotent host install / removal                                                      |
| `bin/preflight.sh`                          | Read-only host checks                                                                  |
| `operating.json`                            | VM-side facts; scheduling policy is owned by `config/ci/operating-config.json`         |

Invariants are asserted by `tests/scripts/ci/infra/*.test.ts`
(`pnpm exec vitest run tests/scripts/ci/infra`).
