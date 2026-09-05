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

The operator copies a root-owned `/etc/nabatable-ci/actions-proof.json` containing
`repositoryId`, `actorId`, `sha`, and `workflowRef`, binding the admitted job to the
reviewed workflow and exact pushed commit. `proof-admission.sh` rejects forks,
non-push events and mismatched identities before workflow steps. This supplements
isolated VM execution; runner labels alone are not an authorization boundary.

Register with `--ephemeral --disableupdate --no-default-labels`, a single
`nabatable-proof-<full SHA>` label and a unique name. Deliver the short-lived
registration token via stdin to the guest configuration process; do not place
personal tokens or App private keys in the guest. Before listening, verify the
runner registration has only that label and `ephemeral: true`. Set
`ACTIONS_RUNNER_HOOK_JOB_STARTED=/etc/nabatable-ci/proof-admission.sh` in the
runner's trusted startup environment. Never register a host-level runner.

The proof first checks isolation, then deliberately exits 23. A successful
qualification therefore has a failed Actions job with the isolation step passing
and deliberate-failure step failing. Capture the workflow/job IDs, SHA, runner ID,
step conclusions and cleanup evidence. Delete the VM and any remaining runner
registration in a finally block, including on timeout. A separate all-green proof
is required before enabling real check workflows.

The Linux ARM64 proof does not qualify CodeQL. A supported environment and private
repository entitlement, gate isolation, fork-denial proof and a remote protected
deployment host are still required for a complete migration.
