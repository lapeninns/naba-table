---
task: additional-gaps-20260129-1915
timestamp_utc: 2026-01-29T19:15:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts

## VCS CLI Tools

- [ ] Create `scripts/git/log.sh`
- [ ] Create `scripts/git/clean-branches.sh`
- [ ] Create `scripts/git/pr-check.sh`
- [ ] Make scripts executable

## Profiling

- [ ] Update `sentry.server.config.ts` with `profilesSampleRate: 0.1`
- [ ] Update `sentry.edge.config.ts` with `profilesSampleRate: 0.1`

## Documentation

- [ ] Create `docs/rollout-strategy.md`
- [ ] Create `docs/runbooks/` directory
- [ ] Create `docs/runbooks/rollback.md`

## Automated Docs

- [ ] Add TypeDoc to devDependencies
- [ ] Create `typedoc.json` config
- [ ] Add `docs:generate` script to `package.json`
- [ ] Update `.gitignore` to exclude `docs/api/`

## Updates

- [ ] Update `agent-readiness-report.json` (5 criteria)
- [ ] Update `CONTINUITY.md`

## Validation

- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm test`
- [ ] Test VCS scripts manually
- [ ] Test `pnpm docs:generate`

## Notes

- Assumptions: gh CLI installed; Sentry profiling supported in Next.js
- Deviations: None
