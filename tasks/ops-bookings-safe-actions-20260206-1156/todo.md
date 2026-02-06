---
task: ops-bookings-safe-actions
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [ ] Add Sonner (`sonner`) dependency and `components/ui/sonner.tsx`
- [ ] Mount `<Toaster />` in `components/LayoutClient.tsx`
- [ ] Add no-show confirmation dialog to `OpsBookingCardActions`
- [ ] Add 5s undo toast after mark-no-show success
- [ ] Add success/error toasts for check-in/out
- [ ] Remove list-level `refetch()` after lifecycle actions in `OpsBookingsClient`
- [ ] Replace single pending action state with per-booking pending map
- [ ] Remove global lifecycle lock in `BookingsTable`
- [ ] Remove/soften full-card overlay; move pending UI to action button
- [ ] Run `pnpm typecheck` + `pnpm lint` + `pnpm build`
