---
task: perf-app-layout-memberships
timestamp_utc: 2026-02-12T15:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Checklist

- [x] Implement TTL membership cache in `server/team/access.ts`.
- [x] Trim membership select.
- [x] Switch ops layout to cached memberships.
- [x] `pnpm run typecheck`
- [x] `pnpm run lint`
- [ ] Manual QA (authenticated): confirm improved reload TTFB.
- [x] Complete `verification.md` + artifacts.
