# Actions runner qualification

This is a manual, disposable-VM proof lane. It does not route required checks,
register a persistent runner, or replace the local executor or Release gate.

The proof workflow runs only on its named qualification branch and repository
owner. Before registration, the operator provisions a cold clone of the verified
CI image with no host mounts, agent forwarding, or host TCP port forwarding.
`proof-bootstrap.sh` creates a separate non-root account with no sudo or Docker
membership, verifies the Actions runner archive digest, installs a root-owned
admission hook and limits the account to the guest DNS stub and public HTTPS.
The named private, link-local and host networks are denied, including HTTPS.
A UID-specific public HTTPS exception in the inherited golden-image firewall is
needed for the runner transport; normal job-container rules remain enforced.
The bootstrap probes public HTTPS and private HTTP/HTTPS before registration.

The operator copies a root-owned `/etc/nabatable-ci/actions-proof.json` containing
`repositoryId`, `actorId`, `sha`, and `workflowRef`, binding the admitted job to the
reviewed workflow and exact pushed commit. `proof-admission.sh` rejects forks,
non-push events and mismatched identities before workflow steps. This supplements
isolated VM execution; runner labels alone are not an authorization boundary.

Register with `--ephemeral --disableupdate --no-default-labels`, a single
`nabatable-proof-<full SHA>` label and a unique name. Deliver the short-lived
registration token via stdin to the guest configuration process; do not place
personal tokens or App private keys in the guest. Before listening, verify the
remote registration has only that label and its ID matches the guest `.runner`
file, which must declare `ephemeral: true` and `disableUpdate: true`. The repository
runner-list API may omit the ephemeral field. Set
`ACTIONS_RUNNER_HOOK_JOB_STARTED=/etc/nabatable-ci/proof-admission.sh` in the
runner's trusted startup environment. Never register a host-level runner.

The workflow checks VM isolation and private-network denial. Qualification also
requires a reviewed negative run whose final step deliberately exits 23: the
isolation step must pass and the deliberate failure must fail the Actions job.
Restore the successful workflow after the negative proof and execute a second,
all-green run. Capture workflow/job IDs, SHA, runner ID, step conclusions and
cleanup evidence for both. Delete the VM and any remaining runner registration
in a finally block, including on timeout. Neither proof satisfies application
CI or authorizes a release.

The Linux ARM64 proof does not qualify CodeQL. A supported environment and private
repository entitlement, gate isolation, fork-denial proof and a remote protected
deployment host are still required for a complete migration.
