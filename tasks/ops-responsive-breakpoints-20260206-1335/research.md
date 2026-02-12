---
task: ops-responsive-breakpoints
timestamp_utc: 2026-02-06T13:35:06Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops UI Responsive Audit (Tailwind Default Breakpoints)

## Scope

Audit ops UI surfaces impacted by the current branch across Tailwind default breakpoints, using dev-only harness pages where auth/session is not available.

Surfaces:

- Ops bookings list UI
- Ops booking dialog + table assignment
- Ops dashboard
- Ops customers
- Ops email delivery
- Ops new booking (walk-in wizard shell)
- Ops restaurant settings (shell + subnav + key sections)
- Ops tables inventory
- Ops floor plan

## Breakpoints / Devices

Primary widths:

- 320, 375, 414, 640, 768, 1024, 1280, 1536
  Boundary pairs:
- 639/640, 767/768
  Landscape sanity:
- 812x375 (or closest)

## Constraints

- Tailwind breakpoints must remain defaults (no custom `theme.screens`).
- Use Tailwind responsive variants (`sm: md: lg: xl: 2xl:`) and canonical fixes (`min-w-0`, wrapping, explicit overflow).
- DevTools MCP manual QA is mandatory; artifacts captured in `artifacts/`.

## Reuse / Prior Evidence

Existing bookings-related QA artifacts already exist and will be referenced:

- `tasks/ops-bookings-a11y-touch-20260206-1156/`
- `tasks/ops-bookings-safe-actions-20260206-1156/`
- `tasks/ops-bookings-status-system-20260206-1156/`

## Notes

We will add additional dev-only harness routes under `/dev/*` to cover ops pages that require auth, backed by in-memory service implementations that satisfy the real Ops service interfaces.
