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

## Production Evidence (Vercel CLI)

- [x] `vercel inspect nabatable-6chdx9fwg-lapen-inns-projects.vercel.app --logs` (failed deployment logs captured)
- [x] `vercel inspect nabatable-jru8fk5a9-lapen-inns-projects.vercel.app --logs` (failed deployment logs captured)
- Result:
  - Both deployments failed with `./lib/posthog/provider.tsx:78:20` (`Argument of type 'string | null' is not assignable to parameter of type 'string'`).

## Test Outcomes

- [x] `pnpm exec eslint lib/posthog/provider.tsx` (pass).
- [x] `pnpm run build` (pass).
- [x] `pnpm run typecheck` (pass).

## Artifacts

- Vercel failed deploy extracts: `artifacts/vercel-build-errors-20260216.txt`

## Known Issues

- None.

## Sign-off

- [x] Engineering
