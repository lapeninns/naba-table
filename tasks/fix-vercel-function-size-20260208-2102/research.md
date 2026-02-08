---
task: fix-vercel-function-size
timestamp_utc: 2026-02-08T21:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Vercel Serverless Function Size Failure

## Requirements

- Functional:
  - Vercel build must not bundle large `tasks/**/artifacts` data into serverless functions.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No security regressions; keep build deterministic.
  - Avoid deleting or moving artifacts without explicit request.

## Existing Patterns & Reuse

- Next.js `outputFileTracingExcludes` can remove paths from serverless tracing.
- `.vercelignore` can exclude files from build context upload.

## External Resources

- None.

## Constraints & Risks

- Must not delete or move artifacts; only exclude from tracing/build context.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add `outputFileTracingExcludes` to `next.config.js` for `tasks/**/artifacts/**`.
- Add `.vercelignore` to keep `tasks/**/artifacts/**` out of build context.
