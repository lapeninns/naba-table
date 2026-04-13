---
task: ops-dashboard-membership-503
timestamp_utc: 2026-04-13T16:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops dashboard membership validation 503 handling

## Objective

Return a retryable `503` for transient membership-validation failures in ops dashboard APIs so production incidents are surfaced accurately and the dashboard can recover cleanly on retry.

## Success Criteria

- [ ] Dashboard summary route returns `503` with a stable error code when membership validation is temporarily unavailable.
- [ ] Dashboard heatmap, changes, and rejections routes use the same access behavior.
- [ ] Normal successful access and normal forbidden access remain unchanged.

## Architecture & Components

- `server/team/access.ts`: classify transient upstream membership-query failures.
- `server/auth/guards.ts`: map transient membership validation failures to a retryable guard error.
- `src/app/api/ops/dashboard/_shared.ts`: shared dashboard access and error-response helper.
- Dashboard routes: use the shared helper instead of duplicating auth/membership handling.

## Testing Strategy

- Route regression test for summary route `503` mapping.
- Focused lint/typecheck.
- Re-run existing booking capacity route tests to make sure the earlier production change remains stable.

## Rollout

- Ship as a direct production follow-up patch.
- Verify `/api/health` and inspect the live dashboard endpoint behavior/logs after deploy.
