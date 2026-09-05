# Mac runner preparation: 2026-09-05

Status: **provisioning in progress** using the existing macOS login through the user-authorized `--current-user` option. The golden VM and job image have been built and the exported disk passed `qemu-img check`; disposable-clone tests passed the network, filesystem, and Chromium checks but exposed a pnpm cache location bug. The image is being rebuilt with a shared root-owned offline Corepack cache before qualification is repeated. The controller service is **not activated**. Local tests and rendered configuration are preparation evidence, not end-to-end CI qualification.

## Host checks

- Apple silicon, macOS 26.5.1, 18 logical CPUs, 64 GiB RAM.
- AC power and more than 480 GiB free disk; configured minimum remains 100 GiB.
- Lima 2.2.0 and Docker CLI 29.7.2 already installed. QEMU 11.1.1 and Homebrew Node 22.23.2 installed for the CI runtime.
- Normal VM allocation remains 6 CPUs / 16 GiB; dedicated allocation remains 10 CPUs / 24 GiB.
- Host preflight passes after provisioning fixes. Rendered Lima configuration passes `limactl validate`; this does not prove VM isolation or execution.
- The dedicated `nabatable-ci` account was not created. This setup explicitly uses the existing non-root login; the dedicated account remains the installer default for other installations.
- FileVault is enabled, a VPN is connected, and system sleep is enabled. Qualification must cover these conditions as described in the [runbook](../runbooks/local-ci.md).

## Existing-user isolation boundary

This option does **not** create a separate macOS user or an OS-level boundary from the user's other processes and login Keychain. The controller's normal entry point clears the ambient environment, including developer credentials and `NODE_OPTIONS`, before reading CI-only settings. Its runtime may receive only the named CI credentials; CI release checkouts must contain no credentials or real `.env` files.

CI files live under the private `0700` `$HOME/nabatable-ci` root. Current-user mode forces `LIMA_HOME=$HOME/nabatable-ci/lima` and `DOCKER_CONFIG=$HOME/nabatable-ci/docker`, separating CI instances and Docker contexts from personal defaults. Disposable job VMs retain `mounts: []`, sanitized `test-*` settings, and the existing network and privilege restrictions. These controls do not turn the shared macOS login into a separate security principal.

`--no-start` writes `RunAtLoad=false` and `KeepAlive=false` and does not bootstrap or kickstart the agent. An already loaded agent is unchanged. Activation waits for credentials, configuration, and qualification evidence.

## Live provisioning fixes

The real build exposed and verified fixes for Docker's documented `production.cloudfront.docker.com` download endpoint, the conflict between host networking and user namespace remapping, and Docker restarting into its remapped storage after the job network had already been created. Image build steps now use the restricted job network in `prep` phase and restore `test` phase on exit. The pinned temporary registry alone uses guest host networking with a loopback-only listener; it is removed with its anonymous volume before export. CI jobs keep user namespace remapping. Guest failure and cleanup status propagate to the host, so failed cleanup cannot produce an exported image. Export supports Lima 2.2 `disk` and legacy `diffdisk` layouts.

## Pinned build inputs

| Input                | Pin                                                                                             | Source                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ubuntu 24.04 ARM64   | release-20260826; SHA-256 `afa139bac6f2629c1e1f2f8f34215f3a9ad9779801bcb945521ba1a45016743f`    | [Ubuntu SHA256SUMS](https://cloud-images.ubuntu.com/releases/noble/release-20260826/SHA256SUMS)                     |
| Docker Engine / CLI  | `5:29.7.2-1~ubuntu.24.04~noble`                                                                 | [Docker Noble ARM64 packages](https://download.docker.com/linux/ubuntu/dists/noble/stable/binary-arm64/Packages.gz) |
| Node job-image base  | `node:22-bookworm-slim@sha256:8d342e46d3b2883df69f797cb60fc71d8a0b65de65ddfbf4bf63fdc02049615f` | Docker Hub official `library/node`, Linux ARM64 manifest                                                            |
| Local build registry | `registry:2@sha256:fa647fc1e5d5df7d8d923fb6332aab8e78783f8fca1a1394efb4011f68f5a793`            | Docker Hub official `library/registry`, Linux ARM64 manifest                                                        |

The complete Ubuntu image was downloaded and its SHA-256 matched the published value.

These are qualification inputs, not a qualified golden image or CI job image. Those output digests can only be accepted after the selected CI owner builds and tests the images.

For this existing-user setup, from the reviewed release with Node 22 and pinned pnpm on PATH:

```sh
export NABATABLE_CI_NODE_IMAGE_DIGEST=sha256:8d342e46d3b2883df69f797cb60fc71d8a0b65de65ddfbf4bf63fdc02049615f
export NABATABLE_CI_REGISTRY_IMAGE_DIGEST=sha256:fa647fc1e5d5df7d8d923fb6332aab8e78783f8fca1a1394efb4011f68f5a793
sh infra/local-ci/bin/build-base-image.sh --current-user --mode normal --plan
# The actual build uses the same command without --plan; qualification is still pending.
```

## Candidate image outputs

The build completed on this Mac. The first export attempt exposed the Lima 2.2 disk filename change; the stopped raw disk was exported with `qemu-img convert` after confirming its format. The updated builder lookup has executable coverage for both layouts. The image is a qualification candidate until the remaining checks below pass.

- Golden file: `$HOME/nabatable-ci/images/nabatable-ci-golden-20260905T124259Z.qcow2` (about 1.4 GiB), integrity check passed.
- Golden SHA-256: `369f10746797f15a5d781b7a5e57b27ccde4e05beadff2945c7d6351b1812f0c`.
- Job image: `ci-registry.local/nabatable/ci-job@sha256:26e874bd91441065b8b77c4bf5b09659492061880f7a0ad931808b4426ed4fc9`.

## Verified GitHub identifiers

The repository belongs to the personal GitHub account `lapeninns`, not an organization. Use the personal-account App registration page when provisioning.

| Identifier                        | Value                 |
| --------------------------------- | --------------------- |
| Repository                        | `lapeninns/nabatable` |
| Repository ID                     | `1105219228`          |
| Security guards workflow          | `274220806`           |
| CodeQL security review workflow   | `228506336`           |
| Hosted profile fallback workflow  | `350875947`           |
| Operational verification workflow | `350875948`           |
| Release gate workflow             | `350875950`           |

The [GitHub App registration settings](https://github.com/settings/apps/new) for `nabatable-local-ci` need repository permissions `checks: write`, `metadata: read`, `contents: read`, `pull_requests: read`, and `actions: read`. Disable webhooks for this polling App and install only on `lapeninns/nabatable`. Generate and store its private key only as the named CI item in the selected owner's login Keychain; the item account field remains `nabatable-ci`. The dispatch App and operational Worker are separate provisioning steps; this App gets no Actions write permission.

## Remaining activation steps

1. Keep the existing-user opt-in explicit. Prepare the reviewed release under `$HOME/nabatable-ci/releases/<commit>` and its `current` symlink; do not point it at a developer checkout. Stage the agent with `sh infra/local-ci/bin/install.sh --current-user --no-start`.
2. Complete the running golden-image build, inspect both generated image digests, and perform the isolation and correctness qualification checks. Do not treat a successful download, VM boot, or build alone as qualification.
3. Provision the GitHub Apps, write-only R2 evidence credentials, and the operational heartbeat receiver. Keep the CI App key, evidence credentials, and heartbeat token in the selected owner's named CI Keychain items; hosted deployment credentials stay in their appropriate hosted secret stores.
4. Populate and review controller/policy/trust configuration using the verified identifiers and real output digests. Configure only explicitly trusted human actors for local PR execution.
5. Run `pnpm ci:controller --check-config`, executor dry-run, and the runbook's isolation/correctness checks before starting the LaunchAgent.
6. Prove a passing job, deliberate failing job, evidence-upload failure, and heartbeat end to end. Begin shadow mode before retiring any hosted workflow.

GitHub Actions billing remains unresolved. The local controller can execute jobs independently after provisioning, but the hosted release gate, CodeQL, and security workflows still require working Actions capacity. Local activation does not remove that dependency.
