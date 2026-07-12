## Risk tier

High: the future implementation crosses customer consent, redirect security, migrations, signed
callbacks, outbound providers, and production release controls.

## Affected surfaces and files

Only the four Micro-Specs, their evidence ledgers, this task folder, and `CONTINUITY.md`.

## Route/API identity

Not applicable to spec authoring; no runtime surface is changed in this task.

## Shared-ownership decision

The isolated worktree is clean and this assignment owns only the explicitly allowed governance files.

## Success criteria

Four complete active specs; machine-created lifecycle evidence; governance gates green; malformed
activation refusal proven; exact allowed-file status proven; intentional draft and activation commits.

## Implementation sequence

1. Scaffold through `governance:new-spec` and normalize into numbered area folders.
2. Fill all six sections and commit the complete draft contracts.
3. Activate through `governance:advance` and commit machine evidence.
4. Run governance/tests/refusal QA and record exact outcomes.

## Verification plan

Run `pnpm guard:micro-specs`, `pnpm test:micro-specs`, `pnpm governance:check`, a malformed fixture
activation test, fresh content/status reads, and an allowed-path-only git audit.

## Stop rules

Stop before product code, remote writes, deployment, provider mutation, or production smoke.
