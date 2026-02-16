---
task: debug-old-crown-missing-assignment-ebr
timestamp_utc: 2026-02-16T01:06:30Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Debug Missing Table Assignment (Old Crown Girton, Prod)

## Requirements

- Functional:
  - Determine why booking/contact `ebrain@doctors.org.uk` did not receive a table assignment in production for Old Crown Girton.
  - Confirm whether failure occurred in quote, hold confirm, assignment RPC, or post-assignment sync.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Production-safe and read-only diagnosis unless explicit write approval is provided.
  - Do not expose PII/secrets in artifacts.

## Existing Patterns & Reuse

- Assignment API/service path:
  - `src/app/api/ops/bookings/[id]/assign-tables/route.ts`
  - `server/capacity/table-assignment/assignment.ts`
  - `server/capacity/v2/supabase-repository.ts`
- Auto-assignment path:
  - `server/jobs/auto-assign.ts`
- Similar prior diagnosis task:
  - `tasks/debug-railway-table-assignment-20260204-1213/`

## External Resources

- N/A (repo + production telemetry/database evidence)

## Constraints & Risks

- Supabase remote-only.
- Production writes/deletes are out of scope without explicit user approval.
- PostHog MCP may be unavailable; fallback via API/query scripts may be required.

## Open Questions (owner, due)

- What exact booking datetime should be treated as primary incident? (owner: user, due: during triage)

## Findings

- Environment targeting:
  - Linked project in repo: `ndxmivcrehsacuerwxtm` (staging).
  - Production evidence run intentionally against `vrdiqfudmwydclqpydee` via `.env.vercel-production.live` with explicit ref check in script.
- Incident booking identified:
  - Booking `160681eb-ca50-4a52-90d3-4e4e2f12f3d2` (`FP9SWA7D24`) for `ebrain@doctors.org.uk` at Old Crown Girton (`a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`).
- Auto-assignment outcome:
  - Inline and async auto-assign both failed with reason `Insufficient filtered capacity`.
  - Observability shows `auto_assign.failed` and `auto_assign.summary` (`result=exhausted`, `maxAttempts=1`).
  - Booking `details.pending_admin_notified_at` was set (`2026-02-14T18:22:34.017Z`).
- Assignment actually happened later:
  - Audit evidence shows manual assignment at `2026-02-15T11:48:27.227722Z` to table `05` (`dc0f39c9-9e7a-4cfd-a1d9-7070da40e88a`) by profile id `b9afc366-0b44-48cc-af91-3a9062df9fd0` (`oldcrown@lapeninns.com`).
  - Booking progressed `confirmed -> checked_in -> completed`.
  - Assignment was cleared at checkout (`booking_table_assignment` audit `unassigned` at `2026-02-15T17:13:16.039362Z`), explaining why current assignment rows are zero.
- Related codepath behavior validated:
  - Completion/checkout/no-show flows call `clearBookingTableAssignments`, which removes assignment rows by design.
  - Planner failure string `Insufficient filtered capacity` is emitted in `quoteTablesForBooking` when filtered candidate capacity is below party size.

## Recommended Direction (with rationale)

- Operational interpretation:
  - This booking did receive a manual table assignment before service; current unassigned state is expected post-checkout cleanup.
- Product/engineering follow-ups:
  - Patch planner reason classification so `Insufficient filtered capacity` is not emitted as `unknown`.
  - Add deeper telemetry for quote failures (explicit filtered table IDs/capacity and filter-stage counts) to reduce ambiguity in future incidents.
  - Review whether table `status` gating in `filterAvailableTables` should be decoupled from future-date quote decisions, since status is current-operational and may not reflect future-window availability.
