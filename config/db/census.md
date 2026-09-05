# Migration census and immutability baseline

`migration-checksums.json` is the reviewed census of every file under `supabase/migrations`.
It is read by `pnpm db:check-migration-immutability` (and, before any remote plan, by
`pnpm db:plan-remote`) and it fails closed:

- A recorded file whose sha256 or byte length differs from the baseline is a **failure**.
- A recorded file that has been removed is a **failure**.
- A file that is not yet recorded is **allowed** and reported; it is only appended to the
  baseline through `pnpm db:check-migration-immutability --record --reviewed`, which must be
  run by the reviewer who read the migration. Recorded entries are never rewritten by that
  command.

## Reviewed baseline

| Field                    | Value                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Reviewed baseline date   | 2026-09-04                                                                                     |
| Algorithm                | sha256 over the exact file bytes                                                               |
| Files recorded           | 121 (120 versioned migrations plus `CONSOLIDATED_ALL_MIGRATIONS.sql`)                          |
| Source of truth for hash | The committed content of each file at the reviewed revision, never an uncommitted working copy |

`20260809120000_gbp_write_safety_foundation.sql` is recorded from its committed content. A
local, uncommitted edit to that file (or any other recorded migration) is reported as
`CHANGED` by `pnpm db:check-migration-immutability` until a reviewer deliberately removes and
re-records the entry as part of the same review that changes the file. The contract test
(`tests/scripts/db-promotion-safety.test.ts`) compares the baseline against the committed tree
so it is deterministic on CI and on developer machines.

`CONSOLIDATED_ALL_MIGRATIONS.sql` is not a versioned migration (its name carries no version
prefix, so the Supabase CLI ignores it) but it lives in the migrations directory and is
therefore recorded so that edits to it are visible.

## Historical migrations are NOT assumed safely replayable

The baseline records what the files are, not that they can be re-run. Historical schema
changes were partly applied through the Supabase SQL editor and staging has been refreshed by
cloning production (see `docs/db/supabase-baseline-migrations.md`). Consequently:

- No workflow replays recorded migrations. `supabase migration repair`, `supabase db reset`,
  explicit version replay and forcing flags are refused by `scripts/db/safe-run.ts` regardless
  of target.
- `--include-all` remains limited to the single documented exception (the
  `20260811160000` production backfill guarded by `CONFIRM_PRODUCTION_INCLUDE_ALL`) and is
  refused for every other workflow, including `plan-remote`.
- `pnpm db:plan-remote` compares the remote ledger (`supabase migration list --linked`) with the
  local files before running `supabase db push --dry-run`. Versions applied remotely that are
  missing locally, and pending local versions older than the newest applied version, stop the
  plan.

## Updating the baseline

1. Review the new migration file(s) in full.
2. Run `pnpm db:check-migration-immutability` and confirm the only findings are the expected
   `unrecorded` entries.
3. Run `pnpm db:check-migration-immutability --record --reviewed` and commit
   `config/db/migration-checksums.json` together with the migration in the same pull request.

`tests/scripts/db-promotion-safety.test.ts` asserts that this baseline still matches the working
tree (no recorded file changed or disappeared), so a migration edit without a baseline review
fails the unit suite as well as the promotion workflows.
