---
task: fix-ops-ui-issues
timestamp_utc: 2026-02-08T20:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops UI + Security Fixes

## Requirements

- Functional:
  - Status labels must use canonical ops labels (e.g. "Checked in", "No show").
  - Server-side prefetch must not trust `x-forwarded-host`/`host` for origin (SSRF safety).
  - Heatmap calendar selection must not drift across timezones.
  - "Filter bookings" control must be functional or removed.
  - Skeleton divider should render as intended or be removed.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No SSRF exposure in server-side prefetches.
  - No new perf regressions in dashboard render.
  - Maintain accessible labels/controls.

## Existing Patterns & Reuse

- Canonical status labels: `lib/ops/booking-status.ts`.
- Canonical site URL: `lib/site-url.ts`.
- Date formatting helpers: `lib/utils/datetime.ts` and Luxon usage elsewhere.

## External Resources

- None.

## Constraints & Risks

- SSRF risk: origin must be derived from trusted env only.
- Timezone drift: calendar must preserve restaurant date across runtime timezones.
- UI changes require consistent behavior across /app dashboard.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use trusted env-based origin helpers from `lib/site-url.ts` in all server-side prefetches to remove header trust.
- Use canonical ops status labels via lookup and fallback for unknown strings.
- Build calendar selection dates from restaurant date parts to avoid timezone drift.
- Make filter control do something deterministic (scroll to filters) rather than being inert.
- Fix skeleton divider visibility to intended breakpoint.
