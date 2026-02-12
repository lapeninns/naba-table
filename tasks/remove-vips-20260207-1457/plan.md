---
task: remove-vips
timestamp_utc: 2026-02-07T14:57:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove VIPs Feature Codepaths

## Objective

Remove the VIPs endpoint/hook/server-op so there is no remaining VIPs feature surface in the app or API, while keeping the repository compiling and tests passing.

## Success Criteria

- [ ] `src/app/api/ops/dashboard/vips/route.ts` removed and no longer part of routing.
- [ ] `src/hooks/ops/useOpsTodayVIPs.ts` removed and not referenced.
- [ ] `server/ops/vips.ts` removed and not referenced.
- [ ] `pnpm` build/typecheck passes (or project equivalent).
- [ ] No references remain to `/api/ops/dashboard/vips` or `useOpsTodayVIPs`.

## Change List

1. Locate and remove any remaining imports/callers of the VIPs hook, endpoint, and server op.
2. Delete the three files via `trash` (per policy).
3. Re-run repo search to ensure no VIPs codepath references remain.
4. Run verification commands (typecheck/lint/tests).
5. Manual QA via Chrome DevTools MCP:
   - Load local app.
   - Confirm no console errors and no network requests to the removed VIPs endpoint.
   - Capture a screenshot artifact.

## Testing Strategy

- TypeScript compile/typecheck.
- Lint.
- Any existing unit/integration tests.

## Rollout

- No flag changes. Removal is complete (feature already effectively disabled via stub server op).
- Monitor for any missing endpoint requests during QA.
