---
task: fix-ops-card-details-desktop
timestamp_utc: 2026-02-04T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Booking Card Details Desktop Visibility

## Requirements

- Functional:
  - Keep ops booking card details (table/contact/notes) visible on desktop.
  - Preserve mobile collapse behavior and hydration stability.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain semantic structure and a11y labels.
  - Avoid introducing layout shift or hydration mismatch.

## Existing Patterns & Reuse

- `components/ui/collapsible` wraps Radix `CollapsibleContent` (children render only when open unless `forceMount`).
- Previous ops booking card used `CollapsibleContent` with `forceMount` and `sm:block` to keep details visible on desktop.
- New split components live under `src/components/features/dashboard/cards/*`.

## External Resources

- Radix Collapsible behavior (children only when open unless `forceMount`).

## Constraints & Risks

- UI change requires Chrome DevTools MCP QA.
- Changes limited to ops booking card details rendering (no new UI primitives).

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Restore `forceMount` on `CollapsibleContent` in `OpsBookingCardDetails` to keep desktop details rendered while keeping mobile collapse.
