# Local CI infrastructure

Configuration for the Mac-hosted, VM-isolated CI runner described in
`docs/runbooks/local-ci.md`. Nothing here contains credentials. The Ubuntu image and Docker Engine inputs
are pinned for qualification; installation-specific IDs and generated image
digests still use `REPLACE_ME_*` placeholders that the scripts refuse to use.
See `docs/ci/mac-runner-preparation.md` for preparation evidence and remaining setup.

The executor (`scripts/ci/executor`) clones a **disposable Lima instance per
request** from a golden base image and destroys it afterwards. The files here
build that golden image and install the Mac-side controller.

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
