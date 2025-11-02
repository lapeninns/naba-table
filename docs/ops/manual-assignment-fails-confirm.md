# Playbook: Manual Assignment Fails at Confirm

## Symptoms

- Operators see errors on Confirm (e.g., HOLD_CONFLICT, POLICY_CHANGED, STALE_CONTEXT).
- UI may show staleness banner or explicit conflict details.

## Immediate Actions

- Ask operator to click “Refresh” in the staleness banner and retry.
- If conflict: identify blocking booking/hold from UI details and resolve (release hold or re-time booking).

## Technical Checks

- Verify outbox worker is healthy (processed events increasing, no rising dead entries).
- Inspect observability events for `manual.confirm.fail{code}`.
- Check `table_holds` for overlapping holds; sweeper should clean expired.

## Remediation

- For POLICY_CHANGED: revalidate selection; ask operator to re-run Validate and Hold.
- For HOLD_CONFLICT: resolve blocking hold(s), then re-run.
- For STALE_CONTEXT: refresh context; ensure Realtime events are flowing.

## Preventative

- Ensure policy changes are communicated; consider temporary feature flag toggles for enforcement ramps.
- Monitor error-rate alert (>=3% over 10m) and investigate spikes.
