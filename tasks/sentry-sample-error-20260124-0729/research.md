---
task: sentry-sample-error
timestamp_utc: 2026-01-24T07:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Sentry Sample Error Trigger

## Requirements

- Functional: Trigger a sample error by calling a nonexistent function so the error is captured by Sentry.
- Non-functional (a11y, perf, security, privacy, i18n): Keep change isolated and safe to invoke on demand; no secrets in source.

## Existing Patterns & Reuse

- `src/app/sentry-example-page/page.tsx` provides a UI button to throw a sample error.
- `src/app/api/sentry-example-api/route.ts` intentionally throws a server error for testing.

## External Resources

- Existing sample page already links to Sentry Next.js docs; no extra external guidance required.

## Constraints & Risks

- Must follow AGENTS SDLC (plan before implementation).
- Avoid impacting normal user flows; prefer opt-in test path.

## Open Questions (owner, due)

- Q: Where should the error be triggered (page or API route)?
  A: Use the existing `sentry-example-page` button for an opt-in trigger.

## Recommended Direction (with rationale)

- Create a dedicated, opt-in test route to trigger the error without affecting standard flows.
