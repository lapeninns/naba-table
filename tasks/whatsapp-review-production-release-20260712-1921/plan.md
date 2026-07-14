## Risk tier

High: the future implementation crosses customer consent, redirect security, migrations, signed
callbacks, outbound providers, and production release controls.

## Affected surfaces and files

Only the four Micro-Specs, their evidence ledgers, this task folder, and `CONTINUITY.md` are edited
in this authoring task. The specs enumerate the exact product/test paths authorized for later work.

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
5. Adversarially verify the union of expected files and each future implemented transition.

## Verification plan

Run `pnpm guard:micro-specs`, `pnpm test:micro-specs`, `pnpm governance:check`, a malformed fixture
activation test, fresh content/status reads, and an allowed-path-only git audit.

## Stop rules

Stop before product code, remote writes, deployment, provider mutation, or production smoke.

## 2026-07-14 release continuation

1. Lock the final approved Content SIDs and provider-assigned categories in the release guard.
2. Clear the Cloudflare staging authenticated-create and redirect proof.
3. Restore the governed Supabase staging credential and realign Vercel Preview to project
   `ndxmivcrehsacuerwxtm` before applying the review-ledger migration.
4. Rerun staging migration, SQL, drift, app, and Worker gates.
5. Only after staging is green, merge the release PR, configure all five booking SIDs in Vercel and
   the manager-summary SID in Cloudflare, deploy, and run the explicitly armed controlled smoke.

Production remains a stop condition while step 3 or step 4 is incomplete.

## 2026-07-14 staging migration-order stop

- Step 3 is complete: rotate the canonical staging credential, isolate Preview DB credentials from
  production/development, and read back all six staging Supabase variables.
- Step 4 is stopped before migration apply. `pnpm db:migrate` requires `--include-all` because 16
  older local versions are missing before the latest remote version; the governed runner does not
  permit that flag.
- Do not baseline the 16 versions as applied: a fresh remote schema dump proves multiple effects
  are absent. Continuing requires an explicit operational/radius decision to apply the historical
  backlog to staging before the review migration.

## 2026-07-14 legacy drink-menu data stop

1. The approved staging-only `--include-all` runner path is implemented and locally verified.
2. Preserve all 144 legacy drink items, 64 modifier groups, and 149 modifier options; do not edit
   migration history or disable the migration guard.
3. Decide and specify the canonical representation for modifier groups/options, then author a
   reversible archive/backfill migration with aggregate parity checks.
4. Only after parity is proven should the retirement migration and remaining backlog replay.

## 2026-07-14 staging database completion

1. Reuse the checked-in idempotent canonical hierarchy backfill, then archive exact legacy rows in
   a restricted staging-only schema and assert archive/item/extension parity before deletion.
2. Resume the historical replay only after all five retirement tables read back empty.
3. Repair any genuine historical idempotency defect test-first without weakening privilege guards.
4. Prove local/remote migration alignment, live ledger shape/privileges/triggers, and the
   transactional real-Postgres invariant script before release configuration.

Steps 1-4 are complete. The release may now proceed to approved SID configuration, staged app
deployment, controlled verification, merge, and production enablement.
