# Playbook: Holds Stuck

## Symptoms

- Operators report holds persisting beyond expiry or after confirm.
- Allocation panel shows ghost holds.

## Immediate Actions

- Trigger hold sweeper job via `pnpm jobs:hold-sweeper` (runs `server/jobs/capacity-holds`).
- Verify `table_holds` entries for the booking and check `expires_at`.

## Technical Checks

- Confirm `runHoldSweeper` runs and logs count of expired holds removed (`holds.sweeper.run` event in observability backend).
- Inspect Realtime subscriptions for `table_holds` to ensure UI refetch triggers.

## Remediation

- Manually release hold via admin tools if available.
- Restart worker/sweeper if it is stuck.

## Preventative

- Cron: run `pnpm jobs:hold-sweeper` every minute (or faster during events). Monitor `holds.sweeper.run` metrics for drift.
- Ensure confirm path releases hold synchronously; fallback to sweeper remains in place.
