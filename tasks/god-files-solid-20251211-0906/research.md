---
task: god-files-solid
timestamp_utc: 2025-12-11T09:06:54Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Reduce god files & improve SOLID

## Requirements

- Functional: reduce "god" backend files by extracting cohesive modules without changing behavior; keep public contracts stable.
- Non-functional: maintain test pass rate and performance; preserve security/authz checks at route boundaries; no DB schema changes.

## Existing Patterns & Reuse

- Folder separation already enforces layers: `src/app/api/**` (HTTP boundary), `server/**` (domain/services), `lib/**` (shared helpers), `libs/**` (vendor wrappers).
- Capacity engine already has v2 orchestrator abstractions (`server/capacity/v2/*`) that we can lean on instead of bespoke logic.
- Booking APIs colocate validation schemas (e.g., `src/app/api/ops/bookings/schema.ts`) — reuse rather than recreate.

## External Resources

- [ ] None yet — Augment MCP unavailable in this workspace; performed manual code scan instead (documented below).

## Constraints & Risks

- Large refactors risk regressions in bookings/capacity flows; must keep behavior identical.
- Avoid changing API surfaces for routes to keep clients stable.
- Scope creep: focus on one high-impact file for first iteration.

## Open Questions (owner, due)

- Q: Which file offers best ROI for first cut (assignment orchestrator vs. bookings route)?
  A: TBD after deeper inspection.

## Recommended Direction (with rationale)

- Target the largest, high-traffic module for a scoped split: `server/capacity/table-assignment/assignment.ts` (1667 lines) or `src/app/api/bookings/[id]/route.ts` (1259 lines).
- Extract pure helpers and repository/IO boundaries (Supabase calls, telemetry) into dedicated modules so the orchestrator focuses on control flow (SRP) and can accept injected ports (DIP).
- Keep public exports and route signatures stable; add unit coverage around new boundaries to guard regressions.

## Evidence of "god" files (manual scan)

- Line counts (wc -l):
  - `server/capacity/table-assignment/assignment.ts` — 1667
  - `src/app/api/bookings/[id]/route.ts` — 1259
  - `src/app/api/bookings/route.ts` — 1167
  - `src/app/api/ops/bookings/route.ts` — 1080
  - `server/capacity/table-assignment/quote.ts` — 1060
  - `server/capacity/table-assignment/availability.ts` — 959
  - `src/app/api/ops/bookings/[id]/route.ts` — 940
  - `server/capacity/table-assignment/manual.ts` — 908
