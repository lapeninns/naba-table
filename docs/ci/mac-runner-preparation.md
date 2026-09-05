# Mac runner preparation: 2026-09-05

Status: host prerequisites prepared; automated service is **not running**. No GitHub App, R2 bucket, operational Worker deployment, service-account credential, or production/staging resource was created during this preparation.

## Host checks

- Apple silicon, macOS 26.5.1, 18 logical CPUs, 64 GiB RAM.
- AC power and more than 480 GiB free disk; configured minimum remains 100 GiB.
- Lima 2.2.0 and Docker CLI 29.7.2 already installed. QEMU 11.1.1 and Homebrew Node 22.23.2 installed for the service account.
- Normal VM allocation remains 6 CPUs / 16 GiB; dedicated allocation remains 10 CPUs / 24 GiB.
- Host preflight passes after provisioning fixes. Rendered Lima configuration passes `limactl validate`; this does not prove VM isolation or execution.
- The `nabatable-ci` account is absent. Administrator authentication is required to create it, and the account must have its own GUI login session and login Keychain.
- FileVault is enabled, a VPN is connected, and system sleep is enabled. Qualification must cover these conditions as described in the [runbook](../runbooks/local-ci.md).

## Pinned build inputs

| Input                | Pin                                                                                             | Source                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ubuntu 24.04 ARM64   | release-20260826; SHA-256 `afa139bac6f2629c1e1f2f8f34215f3a9ad9779801bcb945521ba1a45016743f`    | [Ubuntu SHA256SUMS](https://cloud-images.ubuntu.com/releases/noble/release-20260826/SHA256SUMS)                     |
| Docker Engine / CLI  | `5:29.7.2-1~ubuntu.24.04~noble`                                                                 | [Docker Noble ARM64 packages](https://download.docker.com/linux/ubuntu/dists/noble/stable/binary-arm64/Packages.gz) |
| Node job-image base  | `node:22-bookworm-slim@sha256:8d342e46d3b2883df69f797cb60fc71d8a0b65de65ddfbf4bf63fdc02049615f` | Docker Hub official `library/node`, Linux ARM64 manifest                                                            |
| Local build registry | `registry:2@sha256:fa647fc1e5d5df7d8d923fb6332aab8e78783f8fca1a1394efb4011f68f5a793`            | Docker Hub official `library/registry`, Linux ARM64 manifest                                                        |

The complete Ubuntu image was downloaded and its SHA-256 matched the published value.

These are qualification inputs, not a qualified golden image or CI job image. Those output digests can only be recorded after the service account builds and tests the images.

As `nabatable-ci`, after installing its pnpm shim per the runbook:

```sh
export NABATABLE_CI_NODE_IMAGE_DIGEST=sha256:8d342e46d3b2883df69f797cb60fc71d8a0b65de65ddfbf4bf63fdc02049615f
export NABATABLE_CI_REGISTRY_IMAGE_DIGEST=sha256:fa647fc1e5d5df7d8d923fb6332aab8e78783f8fca1a1394efb4011f68f5a793
sh infra/local-ci/bin/build-base-image.sh --mode normal --plan
# Run without --plan only after the service account and reviewed release are ready.
```

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

The [GitHub App registration settings](https://github.com/settings/apps/new) for `nabatable-local-ci` need repository permissions `checks: write`, `metadata: read`, `contents: read`, `pull_requests: read`, and `actions: read`. Disable webhooks for this polling App and install only on `lapeninns/nabatable`. Generate and store its private key only in the service account's Keychain. The dispatch App and operational Worker are separate provisioning steps; this App gets no Actions write permission.

## Remaining activation steps

1. Create the standard macOS account `nabatable-ci`; log in once to establish its GUI session and Keychain. Enable its secure token/FileVault access through an administrator.
2. Install the account-local pnpm shim, create a reviewed release checkout, build the golden image, and record both output digests.
3. Provision the GitHub Apps, write-only R2 evidence credentials, and the operational heartbeat receiver. Keep all secrets in the dedicated Keychain or their appropriate hosted secret stores.
4. Populate and review controller/policy/trust configuration using the verified identifiers and real output digests. Configure only explicitly trusted human actors for local PR execution.
5. Run `pnpm ci:controller --check-config`, executor dry-run, and the runbook's isolation/correctness checks before starting the LaunchAgent.
6. Prove a passing job, deliberate failing job, evidence-upload failure, and heartbeat end to end. Begin shadow mode before retiring any hosted workflow.

GitHub Actions billing remains unresolved. The local controller can execute jobs independently after provisioning, but the hosted release gate, CodeQL, and security workflows still require working Actions capacity. Local activation does not remove that dependency.
