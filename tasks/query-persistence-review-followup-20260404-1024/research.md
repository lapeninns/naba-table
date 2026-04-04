---
task: query-persistence-review-followup
timestamp_utc: 2026-04-04T10:24:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Query Persistence Review Follow-up

## Requirements

- Functional:
- Address the review finding in `src/app/providers.tsx` so the cache-clear skip only applies to reload-style auth hydration, not genuine login transitions.
- Re-evaluate the related comments about floor-plan redirects and Vitest aliases without introducing unrelated architectural churn.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keep the fix scoped and avoid regressing auth/query persistence behavior.

## Existing Patterns & Reuse

- `src/app/providers.tsx` already centralizes React Query persistence setup and auth-transition cache invalidation.
- The app already uses host/path-sensitive ops routing conventions elsewhere, so redirect normalization belongs to a broader routing abstraction if needed.
- Vitest aliases in `vitest.config.ts` support source imports that resolve under `src/`.

## Constraints & Risks

- The worktree already contains unrelated modifications from earlier tasks; this follow-up should touch only the review-related scope.
- Over-correcting redirect paths risks breaking the subdomain routing convention already used across the ops app.

## Recommended Direction (with rationale)

- Narrow the `providers.tsx` skip condition by checking whether persistence was actually configured before auth resolved.
- Leave the redirect convention unchanged in this pass because it reflects an existing app-wide routing pattern.
- Leave the Vitest aliases unchanged unless a separate config simplification task proves they are truly unnecessary across the current test graph.
