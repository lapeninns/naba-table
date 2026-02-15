---
task: fix-posthog-build-null-key
timestamp_utc: 2026-02-15T14:54:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not required for this change because no UI behavior or rendering path was modified.

## Test Outcomes

- [x] `pnpm run build` executed.
  - Result: `lib/posthog/provider.tsx` nullability error is resolved.
  - Remaining failure: unrelated pre-existing TypeScript issue in `tasks/booking-confirmation-pdf-template-20260212-1831/artifacts/pdf-template-smoke.ts` (`'restaurant' is possibly 'null'`).

## Artifacts

- Build log: `artifacts/build.txt`

## Known Issues

- Local `next build` currently fails due to an unrelated task artifact file included by TypeScript.
- Vercel build context excludes `tasks/**/artifacts/**` via `.vercelignore`, so this blocker should not affect Vercel deployment.

## Sign-off

- [x] Engineering
