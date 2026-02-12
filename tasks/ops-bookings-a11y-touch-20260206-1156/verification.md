---
task: ops-bookings-a11y-touch
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Automated

- [x] `pnpm lint` (0 errors; warnings exist in unrelated files)
- [x] `pnpm typecheck`
- [x] `pnpm vitest run`
- [x] `pnpm build`

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Pages used for manual QA (dev-only harnesses):

- `http://localhost:3000/dev/ops-bookings-list` (added to enable QA without auth)

Checks:

- [x] 375px: touch targets >= 44x44 for key actions (measured via `getBoundingClientRect()`):
  - `More actions`: 44x44
  - `Toggle details`: 44x44
  - `Details`: 74x44 (height 44)
- [x] Collapsible trigger exposes state for assistive tech:
  - `Toggle details` has `aria-expanded` and `aria-controls` wired to the collapsible content.
- [x] Mobile collapse defaults to closed (no auto-expand):
  - Verified that collapsible detail regions are not visible on initial render at mobile widths.
- [x] Notes hint on collapsed cards:
  - When `booking.notes` is present and the card is collapsed on mobile, a small `Notes` badge is shown near the collapse toggle as a discovery affordance.
- [x] 768px: layout stable (screenshot captured)
- [x] 1280px: layout stable (screenshot captured)
- [x] Skip link works and lands at list region:
  - Skip link targets `#ops-bookings-list`
  - List container exposes `id="ops-bookings-list"` + `role="region"` + `tabIndex={-1}`
- [x] Search input does not trigger iOS zoom (16px on mobile):
  - Search input computed `font-size: 16px` (dev harness)
- [x] Sticky toolbar remains visible while scrolling long lists:
  - Scrolled to `scrollY=1400` and toolbar stayed pinned (screenshot captured)

Notes:

- The real `/app/bookings` route requires auth and redirected to `/app/auth/signin` in this environment, so the dev harness was used to validate the UI mechanics (touch targets, skip link, sticky toolbar, search input sizing).

## Artifacts

- Lighthouse (dev build; mobile form-factor): `artifacts/lighthouse-ops-bookings-list-mobile.json`
- Performance trace: `artifacts/dev-ops-bookings-list-trace.json.gz`
- Screenshots:
  - `artifacts/dev-ops-bookings-list-375.png`
  - `artifacts/dev-ops-bookings-list-768.png`
  - `artifacts/dev-ops-bookings-list-1280.png`
  - `artifacts/dev-ops-bookings-list-scrolled-sticky-375.png`
  - `artifacts/dev-ops-bookings-list-notes-hint-375.png`
  - `artifacts/dev-ops-bookings-list-no-show-dialog-375.png` (cross-cutting: safe action dialog also verifies touch targets)
  - `artifacts/dev-ops-bookings-list-no-show-toast-375.png` (cross-cutting: toast presence also verifies A11y-friendly feedback)
