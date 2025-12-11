---
task: auto-assign-overlap
timestamp_utc: 2025-12-11T12:22:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Inline auto-assign overlap errors in production

## Requirements

- Functional:
  - Prevent inline auto-assign from failing with `allocations_no_overlap` during booking creation while still respecting capacity constraints.
  - Preserve strict conflict enforcement across capacity holds/allocations so double-booking doesn9t occur.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI impact; ensure logging remains concise and non-sensitive.
  - Keep Supabase interactions idempotent and performant; avoid noisy retries.

## Existing Patterns & Reuse

- Inline auto-assign flow lives in `server/bookings/inline-auto-assign.ts` and is invoked by `src/app/api/bookings/route.ts` for guest bookings. It logs start/quote/confirm events and uses `atomicConfirmAndTransition` with hold idempotency (`auto_assign_idempotency_key`).
- Capacity confirmation uses `atomicConfirmAndTransition` (`server/capacity/table-assignment/assignment.ts`), which calls PL/pgSQL functions that raise `allocations_no_overlap` on exclusion/unique violations (see schema excerpts in `tasks/db-perf-optimization-20251207-0620/artifacts/schema-before.sql`).
- Background auto-assign job (`server/jobs/auto-assign.ts`) retries and classifies quote failures; it calls the same confirm helper and records observability events.
- Ops booking routes already map `allocations_no_overlap` to HTTP 409 for table assignment errors.

## External Resources

- Production logs (2025-12-11) show inline auto-assign failing with `allocations_no_overlap` on confirm despite hold existing; another trace logs `capacity.hold strict conflict enforcement not honored by server (GUC off)` during quoting, yet confirm eventually succeeds.
- Augment codebase retrieval query captured the relevant modules and error raising points (see summary above).

## Constraints & Risks

- We must not weaken conflict detection (no double allocation). Fix should ensure inline confirm obeys idempotency and handles stale holds gracefully.
- Risk of hiding legitimate overlap errors if we swallow them incorrectly; need clear observability and safe fallback to background auto-assign job.
- Supabase is remote-only; DB changes require staging-first if needed.

## Open Questions (owner, due)

- Is `allocations_no_overlap` triggered because the hold window shifted between quote and confirm? (owner: assistant, due: 2025-12-11)
- Are we missing conflict enforcement GUC (`timescaledb.enable_partitionwise_aggregation`? or app GUC) when invoking Supabase RPC? (owner: assistant, due: 2025-12-11)

## Recommended Direction (with rationale)

- Investigate confirm path to ensure it reuses the hold window from the quote and passes an idempotency key; consider retrying confirm once when `allocations_no_overlap` arises, fetching fresh quote/hold, then falling back to background job.
- Add explicit handling for `allocations_no_overlap` in inline flow: mark inline result as soft failure, schedule background job, and avoid returning error to user.
- Improve logging to include idempotencyKey and table-set details for debugging without exposing PII.
