---
task: responsiveness-audit
timestamp_utc: 2026-01-01T14:37:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Responsiveness Audit (Bookings/Customers/New Bookings/Floor Plan)

## Requirements

- Functional:
  - Audit responsiveness for routes: /bookings, /customers, /new-bookings, /floor-plan.
  - Check horizontal overflow at 768px and 1024px (sidebar interaction).
  - Verify layout container can shrink (min-w-0 + flex-1 behavior).
  - Validate grid/table reflow before cramped.
  - Verify 44x44px touch targets at 375px for common actions.
  - Capture screenshots at 375px, 768px, 1024px, 1440px.
- Non-functional (a11y, perf, security, privacy, i18n):
  - A11y: touch targets, overflow, keyboard nav unaffected.

## Existing Patterns & Reuse

- Use Chrome DevTools MCP for manual UI QA and screenshots.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases in order.
- Manual UI QA via Chrome DevTools MCP required.

## Open Questions (owner, due)

- Q: Confirm reviewer handle(s) if different from default. (owner: github:@amanshresthaa, due: 2026-01-02)

## Recommended Direction (with rationale)

- Run DevTools MCP audits per route at required breakpoints and record findings + artifacts.
