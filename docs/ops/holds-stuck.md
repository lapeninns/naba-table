# Playbook: Holds Stuck

## Symptoms

- Operators report holds persisting beyond expiry or after confirm.
- Allocation panel shows ghost holds.

## Immediate Actions

- Trigger hold sweeper job (if available) or wait for scheduled sweep.
- Verify `table_holds` entries for the booking and check `expires_at`.

## Technical Checks

- Confirm `runHoldSweeper` runs and logs count of expired holds removed.
- Inspect Realtime subscriptions for `table_holds` to ensure UI refetch triggers.

## Remediation

- Manually release hold via admin tools if available.
- Restart worker/sweeper if it is stuck.

## Preventative

- Review sweeper schedule and adjust interval.
- Ensure confirm path releases hold synchronously; fallback to sweeper remains in place.
