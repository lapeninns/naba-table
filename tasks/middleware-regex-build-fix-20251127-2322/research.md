---
task: middleware-regex-build-fix
timestamp_utc: 2025-11-27T23:22:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Next build failure from middleware regex

## Requirements

- Functional: Restore `pnpm run build` to pass; middleware must keep exempting public restaurant schedule/calendar-mask endpoints from ops guard rewrites.
- Non-functional: No change to routing behavior; avoid widening TypeScript target unless necessary.

## Existing Patterns & Reuse

- Routing and ops rewrite rules documented in `src/app/api/README.md` (public schedule/calendar-mask exemption).
- Current middleware logic already isolates static/framework assets and handles ops guard via `requireOpsAuth`.

## External Resources

- None needed; issue is internal TypeScript target compatibility with regex syntax.

## Constraints & Risks

- `tsconfig.json` sets `target: "ES2017"`; named capture groups require ES2018+, causing the current build error at `src/middleware.ts:84`.
- Changing the global TS target could have broader ripple effects; simpler fix is to remove named capture groups in the regex.

## Open Questions (owner, due)

- Do we need the slug capture value elsewhere? (owner: github:@amankumarshrestha, due: before implementation) — currently the code only tests the pattern, so capture value is unused.

## Recommended Direction (with rationale)

- Replace the named-capturing-group regex with an equivalent non-named pattern (`/^\/[^/]+\/(schedule|calendar-mask)(\/|$)/`) to satisfy ES2017 target while preserving behavior. Minimal scope, no compiler target change needed.
