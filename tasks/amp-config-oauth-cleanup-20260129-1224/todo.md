---
task: amp-config-oauth-cleanup
timestamp_utc: 2026-01-29T12:24:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Delete unused `types/next-auth.d.ts`.
- [x] Remove/rename OAuth references in docs (`docs/current-routes.md`, `docs/routing-conventions.md`, `docs/BROKEN-LINKS-AND-ISSUES.md`).
- [x] Remove `components/auth/ImplicitAuthHandler.tsx` and its mount points.
- [ ] Run `pnpm typecheck` and `pnpm test`.
- [ ] Clarify and fix "AMP config" once identified (BLOCKED: no in-repo references found).
