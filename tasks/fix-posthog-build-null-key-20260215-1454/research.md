---
task: fix-posthog-build-null-key
timestamp_utc: 2026-02-15T14:54:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix PostHog Build Null Key Type Error

## Requirements

- Functional:
  - Resolve production build TypeScript failure in `lib/posthog/provider.tsx`.
  - Keep PostHog initialization behavior unchanged when env vars are present.
  - Keep PostHog disabled behavior unchanged when env vars are missing.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No runtime regressions in analytics initialization.
  - No new dependencies.

## Existing Patterns & Reuse

- `clientEnv.posthog` stores `key` and `host` as nullable strings and has `enabled` derived from both.
- `PostHogProvider` gates initialization behind `enabled`, but TypeScript cannot infer that `key` and `host` are non-null.

## External Resources

- None needed; internal type-narrowing fix.

## Constraints & Risks

- A wrong guard could disable analytics even when configured.
- Must preserve ops-host bypass behavior (`app.` host and `/app` path).

## Open Questions (owner, due)

- Q: Should `clientEnv.posthog` be refactored to a discriminated union for stronger compile-time guarantees?
  A: Not required for this fix; keep change narrowly scoped.

## Recommended Direction (with rationale)

- Add explicit null checks for `key` and `host` inside `PostHogProvider` before `posthog.init`.
- Fail fast with existing warning path in development when values are absent.
