---
task: ops-bookings-performance-pass
timestamp_utc: 2026-03-29T16:28:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops bookings performance pass

## Requirements

- Functional:
- Improve performance, smoothness, and maintainability across the prioritized operator pages.
- Preserve existing public/operator behavior unless a change is explicitly justified.
- Do not regress current production Cloudflare/email behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
- Reduce unnecessary rerenders and client-side coordination breadth.
- Keep console/runtime behavior clean or cleaner than today.
- Preserve accessibility and existing navigation/shareable URL behavior.

## Existing Patterns & Reuse

- Dashboard refactor is the reference pattern:
- single data owner
- smaller client boundaries
- ID-driven dialog actions
- precomputed view models
- patch-first mutations

## External Resources

- `vercel-react-best-practices` skill — React/Next.js performance guidance for rerender isolation, deferred rendering, and bundle/client-boundary discipline.

## Constraints & Risks

- Follow the repo SDLC and keep all artifacts in this task folder.
- UI changes require Chrome DevTools MCP verification.
- Keep changes canonical; no duplicate legacy paths or adapters unless justified.
- Avoid regressions to production email delivery or Cloudflare behavior.

## Current Architecture

- `OpsBookingsClient.tsx` was a 755-line client coordinator handling:
- URL/search-param parsing and mutation
- restaurant/session synchronization
- table filter/search/date state
- list query ownership
- lifecycle mutation orchestration
- dialog state
- render-time mapping from list items to DTOs
- `BookingsTable.tsx` virtualized the list, but still built `OpsBookingCard` view models inside the row render path.
- Focused booking details always mounted `useOpsBooking(focusBookingId)`, even when the booking already existed in the current list, which meant extra detail fetch/subscription work.

## Bottlenecks

- Repeated render-time row derivation in `BookingsTable`:
- `buildOpsBookingCardViewModel` ran inside visible-row rendering instead of once per dataset update.
- Broad prop fan-out:
- the table received raw bookings plus mutation maps and rebuilt row-level action state itself.
- Mixed responsibilities in `OpsBookingsClient`:
- query state, data state, lifecycle actions, and dialogs lived in one large client boundary.
- Duplicate detail ownership:
- focus/detail flow could fetch/realtime-subscribe to a booking already present in list state.
- Runtime noise:
- `useOpsBooking` logged realtime subscription messages to the console.

## Likely Rerender Hotspots

- Virtualized bookings rows whenever search/status/date state changed.
- `BookingsTable` row rendering because view-model construction happened inline.
- `OpsBookingsClient` because most handlers and derived data were recomputed in the page shell.

## Bundle & Hydration Concerns

- Bookings is client-heavy, but the highest immediate win was reducing client coordination breadth and per-row work rather than changing server/client ownership.
- Email delivery remains the largest client surface (1243 LOC) and is the strongest next target for tab cold-start and query/dialog splitting.

## Target Ranking (impact first)

1. Bookings

- Hot operator path, large coordinator, repeated row-level derivation, duplicate detail ownership.

2. Email delivery

- Largest page by LOC, likely next best for tab isolation, query parsing cleanup, and keeping inactive panels cold.

3. Customers

- Similar query-param coordination patterns, but the table is already narrower than bookings.

4. Floor plan / seating

- Heavy specialized rendering path; valuable, but best handled as a dedicated scene/inspector isolation pass.

5. Walk-in wizard

- Smallest target; worthwhile only after the larger operator surfaces.

## Open Questions (owner, due)

- Which page offers the highest-value next pass after the initial bookings work? Answer from audit: email delivery. (owner: github:@maintainers, due: follow-up task)

## Recommended Direction (with rationale)

- Start with bookings unless the audit finds a clearly larger win elsewhere.
- Target structural simplification first: split query/data/dialog/action responsibilities, precompute row view models, and reduce broad URL/query churn.
- Shipped scope should focus on bookings only for this pass so the architecture stays coherent and low-risk.
