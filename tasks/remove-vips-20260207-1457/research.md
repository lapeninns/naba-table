---
task: remove-vips
timestamp_utc: 2026-02-07T14:57:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Remove VIPs Feature Codepaths

## Requirements

- Functional:
  - Remove VIPs endpoint `GET /api/ops/dashboard/vips`.
  - Remove VIPs React hook `useOpsTodayVIPs`.
  - Remove server op `getTodayVIPs`.
  - Remove any UI usage of the endpoint/hook so the app compiles and runs.
- Non-functional:
  - Keep TypeScript compile passing and app buildable.
  - No legacy/duplicate VIPs codepaths left behind.
  - Follow safety guard: deletions via `trash`.

## Existing Patterns & Reuse

- VIPs API route is a typical Next.js App Router route handler using `zod` validation, Supabase auth, and `requireMembershipForRestaurant`.
- VIPs hook is a simple `@tanstack/react-query` hook using `fetchJson` against the route.
- Server op is already a stub that returns empty results (loyalty tables removed), but we are removing the feature entirely rather than keeping a stub.

## Inventory (Callers/Imports)

Direct references located:

- `src/app/api/ops/dashboard/vips/route.ts` imports `getTodayVIPs` from `@/server/ops/vips`.
- `src/hooks/ops/useOpsTodayVIPs.ts` calls `/api/ops/dashboard/vips`.

No other in-repo imports/callers found for:

- `useOpsTodayVIPs`
- `/api/ops/dashboard/vips`
- `VIPGuest` / `VIPGuestsResponse` types
- `@/server/ops/vips` import

Potentially related but out of scope (not codepaths): marketing copy uses the term "VIPs" in landing sections.

## Constraints & Risks

- Deleting Next.js route handler files removes the endpoint entirely; ensure no runtime callers remain.
- UI QA requirement applies if any UI behavior changes as a result (even if just removing dead code); will satisfy via Chrome DevTools MCP.

## Open Questions (owner, due)

- None identified; proceeding with full removal of endpoint/hook/op and their file-level definitions.

## Recommended Direction (with rationale)

- Delete the three requested files via `trash` and verify there are no remaining imports.
- Re-run typecheck/lint/tests to ensure compile passes.
- Do a manual smoke check via Chrome DevTools MCP to ensure Ops areas still load and there are no missing-route client calls.
