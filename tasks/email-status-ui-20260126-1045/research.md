---
task: email-status-ui
timestamp_utc: 2026-01-26T10:45:15Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Email Status UI

## Requirements

- Functional:
  - Provide Ops UI to track email status per active customer booking.
  - Filter by email type/state and time window.
  - Support paging for large volumes (>1000 users).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Ops-only access; enforce authn/authz via existing membership checks.
  - WCAG/WAI-ARIA compliance; keyboard navigation.
  - Response times acceptable for ops; avoid N+1 where possible.
  - Do not expose PII beyond existing ops access.

## Existing Patterns & Reuse

- Ops API patterns in `src/app/api/ops/*` with `getRouteHandlerSupabaseClient`.
- Ops service + hook patterns in `src/services/ops/*` and `src/hooks/ops/*`.
- Shadcn UI primitives under `components/ui`.

## External Resources

- N/A (reuse internal patterns; no external docs required yet).

## Constraints & Risks

- Must follow SDLC phases; no coding before plan reviewed.
- UI changes require Chrome DevTools MCP manual QA and artifacts.
- Queue status may not reflect "sent" if emails are processed elsewhere; need to define interpretation.

## Open Questions (owner, due)

- Which email events should be shown (confirmation, reminder_24h, reminder_short, review_request, cancelled, updated, etc.)?
- Should ops view include "sent" vs "queued" vs "failed" only, or also "not scheduled"?
- Should this be Ops-only or visible to restaurant staff dashboards?

## Recommended Direction (with rationale)

- Add an ops API endpoint that returns email job status for active bookings within a configurable time window.
- Build an Ops UI table with filters, leveraging existing ops shell/nav and Shadcn components.
- Use queue job lookups keyed by booking ID + email type to indicate status (waiting/active/delayed/failed/none).
