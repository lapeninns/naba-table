---
task: ops-responsive-breakpoints
timestamp_utc: 2026-02-06T13:35:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops UI Responsive Audit (Tailwind Default Breakpoints)

This task implements dev-only harness pages and captures DevTools MCP evidence for responsiveness at Tailwind default breakpoints. It also fixes any overflow/clipping regressions using Tailwind-first responsive utilities.

## Success Criteria

- [ ] All targeted ops surfaces pass the responsiveness criteria at all required widths.
- [ ] Dev-only harness pages exist for each ops surface requiring auth.
- [ ] `verification.md` includes PASS/FAIL with notes + references to artifacts.
- [ ] Artifacts include screenshots per width per page (and landscape where required).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm vitest run`, `pnpm build` all pass.
