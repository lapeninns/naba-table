# Flaky-test policy

The nightly `Test stability` workflow runs the root suite three times with different deterministic shuffle seeds and runs every Worker suite without retries. A single inconsistent result fails the workflow.

Quarantine is exceptional. Every entry in `config/quality/flaky-tests.yaml` must name an owner, linked issue, expiry date, and isolation reason; the maximum lifetime is seven days. Removal requires ten consecutive green executions. Quarantined tests remain visible and may not be silently skipped.
