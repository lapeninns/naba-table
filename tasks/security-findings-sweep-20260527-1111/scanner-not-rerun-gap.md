# Scanner Not-Rerun Gap

## Scope

This gap applies to the 35-row task-local matrix in `closure-matrix-35.md`.

## Scanner Profile

The original Codex Security/deepsec scanner profile that produced `.deepsec/findings/**` is not available as a runnable local command in this checkout.

Local scripts found:

- `pnpm run security:backlog`: rebuilds backlog files from existing `.deepsec/findings/**`; this is not a scanner rerun.
- `pnpm run security:regression`: runs local regression tests; this is not scanner closure.
- `pnpm run security:guard:service-role`: checks service-role route guard patterns; this is not scanner closure.

## Current Closure Position

No matrix row is marked scanner-closed from local tests alone.

Rows with `already-fixed-needs-evidence` have code and regression evidence attached, but they still need a scanner rerun before scanner closure.

Rows with `historical-leak-needs-rotation` still need external rotation evidence for exposed credentials or generated/test accounts.

Rows with `missing-path-needs-closure-note` need scanner rerun or accepted stale-path closure because the reported paths are historical or missing from HEAD.

## Required Future Evidence

Acceptable scanner closure requires one of:

- Rerun the same Codex Security/deepsec scanner profile and attach the result summary.
- Attach an owner-approved not-rerun risk record that names the scanner profile, explains why it was not rerun, and accepts that local tests are not scanner closure.

Until then, this task packet provides local remediation evidence and an explicit scanner gap, not scanner closure.
