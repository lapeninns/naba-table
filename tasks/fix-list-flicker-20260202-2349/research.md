---
task: fix-list-flicker
timestamp_utc: 2026-02-02T23:49:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix list flicker (virtualized lists)

## Requirements

- Functional:
  - Reduce/stop flicker in Ops Customers, Ops Bookings, and Ops Dashboard lists.
  - Preserve infinite scroll + virtualization behavior.
  - Ensure `/app` routes redirect to Ops sign-in, not guest signup.
  - Improve scroll smoothness on virtualized lists.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain keyboard navigation and focus behavior.
  - Avoid extra re-renders or layout thrash.

## Existing Patterns & Reuse

- `useWindowVirtualizer` with row height caching in:
  - `src/components/features/customers/CustomersTable.tsx`
  - `src/components/features/dashboard/BookingsList.tsx`
  - `components/dashboard/BookingsTable.tsx`
- Animate-in classes are applied per row on render.
- Motion will be used for controlled mount animations.
- Ops auth guard in `src/app/app/(app)/layout.tsx` + page-level redirects in `/app/(app)` routes.

## External Resources

- N/A (use existing repo patterns + Vercel React perf guidance).

## Constraints & Risks

- Short lists are most sensitive to re-measure/animation flicker.
- Realtime updates can invalidate row heights and trigger reflow.
- New dependency: `motion` (Framer Motion) for list animations.
- Incorrect redirect target can send ops users to guest signup.

## Open Questions (owner, due)

- Q: Should animations be entirely disabled for lists below a certain size? (owner: github:@amankumarshrestha, due: 2026-02-02)

## Recommended Direction (with rationale)

- Gate row animations to initial mount only and avoid re-triggering on scroll/measure.
- Throttle or narrow re-measure calls to avoid constant layout shifts.
- Standardize ops auth redirects to `/app/auth/signin`.
- Use translate3d + container-level motion for smoother scroll.
