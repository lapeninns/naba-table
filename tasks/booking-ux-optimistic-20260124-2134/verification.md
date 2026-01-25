---
task: booking-ux-optimistic
timestamp_utc: 2026-01-24T21:34:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Status: Pending (no local dev server started yet)

## Supabase / DB Actions

- Checked enum `booking_status` values: confirmed, pending, cancelled, completed, PRIORITY_WAITLIST, no_show, pending_allocation, checked_in.
- Assigned table to booking `12f65a24-436d-4caa-9c7b-9fc1a90c63e6` using `assign_tables_atomic_v2` (table `049cb2c1-ab64-43cb-b145-6fc6f355aefa`).
- Updated booking status to `confirmed`, then `checked_in` with `checked_in_at` set (UTC timestamp).
- Updated all bookings for `2026-01-24` to `checked_in` with `checked_in_at` set (6 bookings updated).
- Reset all bookings for `2026-01-24` to `checked_in` again to allow retesting (6 bookings confirmed).
- Verified current state: all `2026-01-24` bookings now show `completed` with `checked_out_at` set (query at 2026-01-24T22:27Z).
- Reset all bookings for `2026-01-24` to `checked_in` again (6 bookings confirmed).

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Status updates announced (aria-live)
- [ ] Focus order unaffected

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Seat/Finish updates instantly
- [ ] No full skeleton on refetch
- [ ] Rollback on error
- [ ] Check-out/no-show refresh removes checked-in entries
- [ ] Other bookings disabled during Seat/Finish until mutation completes

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`

## Known Issues

- [ ] Manual QA pending once dev server is running (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA
