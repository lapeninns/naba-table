# Playbook: High Latency Context

## Symptoms

- Manual context or validate/hold requests slower than target (e.g., >400ms P95 on staging seed).

## Immediate Actions

- Verify DB indices exist (see sprint2 perf migration). Re-run EXPLAIN on context queries.
- Ensure context query padding minutes is reasonable via feature flags.

## Technical Checks

- Check observability timers: `context.load.ms`, `validate.ms`, `hold.ms`.
- Confirm in-process cache is active and invalidations are working.

## Remediation

- Reduce padding minutes if safe; expand indices (date, restaurant_id) if needed.
- Profile network and server to isolate bottlenecks.

## Preventative

- Monitor P95/99 dashboards; alert on SLO violation.
- Keep cache TTLs conservative and invalidate on data changes.
