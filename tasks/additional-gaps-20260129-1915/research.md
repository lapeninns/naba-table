---
task: additional-gaps-20260129-1915
timestamp_utc: 2026-01-29T19:15:00Z
owner: github:@droid
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Additional In-Repo Readiness Gaps

## Requirements

**Functional:**

- Add VCS CLI helper scripts for common git workflows
- Enable Sentry profiling instrumentation (profilesSampleRate)
- Document progressive rollout strategy with feature flags
- Add rollback automation runbook/procedures
- Add automated API documentation generation (TypeDoc)

**Non-functional:**

- Follow AGENTS.md conventions
- Keep changes minimal and focused
- No breaking changes to existing tooling
- Maintain existing coverage thresholds

## Existing Patterns & Reuse

- `scripts/` for automation scripts
- `docs/` and `docs/runbooks/` for documentation
- Sentry configs: `sentry.server.config.ts`, `sentry.edge.config.ts`
- Feature flags: `server/feature-flags.ts`, `lib/env.ts`
- `package.json` scripts for common tasks

## External Resources

- [Sentry Profiling docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/profiling/) — profilesSampleRate configuration
- [TypeDoc docs](https://typedoc.org/) — API documentation generation
- [GitHub CLI](https://cli.github.com/manual/) — gh automation

## Constraints & Risks

- Profiling adds overhead; use conservative sample rate (0.1 = 10%)
- VCS scripts should not interfere with existing workflows
- Rollout strategy must align with existing feature flag infrastructure
- TypeDoc must not break existing build pipeline

## Open Questions (owner, due)

- None

## Recommended Direction (with rationale)

1. **VCS CLI tools**: Add `scripts/git/` with helpers for log formatting, branch cleanup, PR checks
2. **Profiling**: Enable `profilesSampleRate: 0.1` in Sentry configs (10% sampling)
3. **Rollout strategy**: Create `docs/rollout-strategy.md` documenting flag-based rollout with exposure stages
4. **Rollback**: Add `docs/runbooks/rollback.md` with step-by-step rollback procedures
5. **Doc generation**: Add TypeDoc config + `pnpm docs:generate` script for API docs
