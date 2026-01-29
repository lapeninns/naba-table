---
task: additional-gaps-20260129-1915
timestamp_utc: 2026-01-29T19:15:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Additional In-Repo Readiness Gaps

## Objective

Fix 5 remaining in-repo readiness gaps to improve score from 61/81 to 66/81 (81%).

## Success Criteria

- [ ] VCS CLI helper scripts created in `scripts/git/`
- [ ] Sentry profiling enabled with 10% sample rate
- [ ] Rollout strategy documented with feature flag guidance
- [ ] Rollback runbook added with step-by-step procedures
- [ ] TypeDoc configured for automated API documentation
- [ ] `agent-readiness-report.json` updated (66/81)
- [ ] All validators pass

## Architecture & Components

1. **VCS CLI tools**:
   - `scripts/git/log.sh` — Pretty git log with branch graph
   - `scripts/git/clean-branches.sh` — Remove merged local branches
   - `scripts/git/pr-check.sh` — Pre-PR validation (lint/test/format)

2. **Profiling**:
   - Update `sentry.server.config.ts` → add `profilesSampleRate: 0.1`
   - Update `sentry.edge.config.ts` → add `profilesSampleRate: 0.1`

3. **Rollout strategy**:
   - `docs/rollout-strategy.md` → feature flag lifecycle, exposure stages, metrics

4. **Rollback**:
   - `docs/runbooks/rollback.md` → rollback procedures, flag disabling, version revert

5. **Doc generation**:
   - `typedoc.json` → TypeDoc configuration
   - `package.json` → add `docs:generate` script
   - `.gitignore` → exclude `docs/api/`

## Data Flow & API Contracts

N/A (tooling and documentation only)

## UI/UX States

N/A (no UI changes)

## Edge Cases

- VCS scripts: handle missing gh CLI gracefully
- Profiling: ensure 10% sample rate doesn't impact performance
- Rollback: cover both flag-based and version-based rollback

## Testing Strategy

- Manual: run each VCS script
- Manual: verify Sentry profiling in staging
- Manual: run `pnpm docs:generate` and verify output
- Automated: validators (lint/typecheck/test)

## Rollout

- Immediate; no feature flags needed

## DB Change Plan

N/A
