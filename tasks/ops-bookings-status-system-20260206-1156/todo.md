---
task: ops-bookings-status-system
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Add `lib/ops/booking-status.ts` canonical config
- [ ] Refactor booking-status components and filters to use canonical config
- [ ] Refactor booking dialog to use canonical config (labels, badge)
- [ ] Refactor Ops list rail colors to use canonical config with urgency overrides
- [ ] Remove duplicate status config files and dead paths
- [ ] Run `pnpm typecheck` + `pnpm lint` + `pnpm build`
