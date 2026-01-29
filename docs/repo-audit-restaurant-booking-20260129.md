# Repo Audit: Restaurant Table Booking App (Nab a Table)

Date: 2026-01-29
Repo: `SajiloReserveX`

## Assumptions

- Audit performed via static analysis of this working tree + local commands (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`).
- “MVP” defined as: safe to accept real bookings (no double booking), basic restaurant ops, minimal security/compliance, stable UX.
- Where something is “Missing/Unclear”, it means no direct evidence was found in the searched paths; it may exist elsewhere.

## Repo Snapshot (evidence)

- Stack: Next.js App Router + React + TypeScript + Supabase (Postgres/Auth/Storage) + BullMQ + Upstash Redis.
  - `README.md`
  - `package.json`
- DB: Supabase migrations under `supabase/migrations/*.sql`.
  - `supabase/migrations/CONSOLIDATED_ALL_MIGRATIONS.sql`
  - `supabase/migrations/20260117_add_soft_holds.sql`
  - `supabase/migrations/20260120_restore_capacity_rules.sql`
- Tests:
  - Unit/integration (Vitest): `pnpm test` (45 files / 276 tests passed).
  - E2E (Playwright) documented: `tests/e2e/README.md`.
- Lint/typecheck:
  - `pnpm lint` (0 errors; 15 warnings, mostly `any` and unused vars).
  - `pnpm typecheck` (passed).
- Build:
  - `pnpm build` succeeded; route list printed.
  - Notable: sitemap output shows `https://shipfa.st/...` (likely misconfigured base URL).

## 1) Executive summary (what’s good / biggest risks)

### What’s good

- Ops-first product shape: dashboard + table assignment + lifecycle (check-in/out/no-show) + table timeline.
- Real concurrency primitives:
  - Soft-holds with exclusion constraints (race prevention) (`supabase/migrations/20260117_add_soft_holds.sql`).
  - Capacity enforcement via DB RPC with idempotency and explicit row locking (`supabase/migrations/CONSOLIDATED_ALL_MIGRATIONS.sql`).
- Idempotency patterns are present across booking and ops flows (`src/app/api/bookings/route.ts`, `server/capacity/transaction.ts`).
- Abuse prevention and observability foundations:
  - Rate limiting (`server/security/rate-limit.ts`, `src/app/api/availability/route.ts`).
  - Observability event recording (`server/observability`, referenced by API routes).
- Test posture is non-trivial:
  - Unit/integration tests cover booking and capacity edge paths.
  - E2E/a11y/visual suites are documented (`tests/e2e/README.md`).

### Biggest risks

- P0: Developer onboarding env template is effectively empty (`.env.example` only contains `NEXT_PUBLIC_CLARITY_PROJECT_ID`).
- P0: `docs/DATABASE_MIGRATIONS.md` contains unresolved merge conflicts.
- P0: Cron endpoints are unauthenticated if `CRON_SECRET` is not set; code logs that the endpoint is unprotected.
  - `src/app/api/cron/process-emails/route.ts`
  - `src/app/api/cron/auto-complete-bookings/route.ts`
- P0/P1: `waiting_list` table exists and status enum includes `PRIORITY_WAITLIST`, but no clear customer waitlist API/UI entrypoint found.
  - `server/bookings.ts` (waiting list functions)
  - `backups/public_tables.sql` (waiting_list table)
  - `lib/enums.ts` (booking statuses)
- P1: Availability endpoint requires `time` (no “all-day slots” response) (`src/app/api/availability/route.ts`).
- P1: Payments/deposits and SMS are not implemented (marketing mentions exist, but no provider integration found).

## 2) Feature Inventory Table

| Area      | Feature                                                            | Status              | Evidence                                                                                                                                            | Notes / gaps                                               |
| --------- | ------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Customer  | Multi-restaurant browse                                            | Implemented         | `src/app/(public)/(marketing)/restaurants/page.tsx`                                                                                                 | Multi-tenant implied by memberships + restaurantId scoping |
| Customer  | Restaurant detail page (address/map/contact)                       | Implemented         | `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`                                                                                          | Map embed depends on `NEXT_PUBLIC_GOOGLE_MAPS_KEY`         |
| Customer  | Booking entry from restaurant page                                 | Implemented         | `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`, `src/components/features/booking/wizard/ReservationWizardClient.tsx`               | Wizard integration via `reserve/**`                        |
| Customer  | Party/date/time selection                                          | Implemented         | `reserve/features/reservations/wizard/ui/steps/PlanStep.tsx`, `reserve/features/reservations/wizard/ui/steps/plan-step/components/TimeSlotGrid.tsx` | Time slot selection in wizard                              |
| Customer  | Real availability (slot check + alternatives)                      | Partial             | `src/app/api/availability/route.ts`                                                                                                                 | Requires `time` (no day-grid)                              |
| Customer  | Calendar mask (date-range availability hints)                      | Implemented         | `src/app/api/restaurants/[slug]/calendar-mask/route.ts`                                                                                             | Builds mask from server schedule logic                     |
| Customer  | Schedule API for slots/interval/duration                           | Implemented         | `src/app/api/restaurants/[slug]/schedule/route.ts`                                                                                                  | Cached 60s                                                 |
| Customer  | Create reservation (guest)                                         | Implemented         | `src/app/api/bookings/route.ts`, `server/capacity/transaction.ts`                                                                                   | Capacity RPC + idempotency + rate limiting                 |
| Customer  | Confirmation page + booking reference                              | Implemented         | `src/app/(public)/bookings/booking-page.tsx`, `src/components/features/booking/detail/ReservationDetailClient.tsx`                                  | Includes sharing actions                                   |
| Customer  | Guest portal (bookings list/detail)                                | Implemented         | `src/app/guest/bookings/page.tsx`, `src/app/guest/bookings/[bookingId]/page.tsx`                                                                    | Deep-linkable                                              |
| Customer  | Modify booking                                                     | Implemented         | `server/bookings/modification-flow.ts`, `src/app/api/bookings/[id]/route.test.ts`                                                                   | Self-serve locks + grace window                            |
| Customer  | Cancel booking                                                     | Implemented         | `src/app/api/bookings/[id]/route.test.ts`                                                                                                           | Cutoff and past-time rules tested                          |
| Customer  | Session recovery token for booking mgmt                            | Implemented         | `src/app/(public)/bookings/recover/route.ts`                                                                                                        | Sets cookie `sr_access`                                    |
| Customer  | Waitlist join                                                      | Missing/Unclear     | `server/bookings.ts`, `backups/public_tables.sql`, `lib/enums.ts`                                                                                   | No clear customer-facing route found                       |
| Admin/Ops | Auth (Supabase) + session guards                                   | Implemented         | `server/auth/guards.ts`, `server/auth/ops-guard.ts`                                                                                                 | Uses Supabase user + membership                            |
| Admin/Ops | RBAC (restaurant roles)                                            | Implemented         | `server/team/access.ts`, `lib/owner/auth/roles.ts`                                                                                                  | Owner/admin gating in ops routes                           |
| Admin/Ops | Ops dashboard routes                                               | Implemented         | `pnpm build` route list (e.g. `/app/dashboard`, `/app/bookings`)                                                                                    | Host routing via middleware `src/proxy.ts`                 |
| Admin/Ops | Restaurant settings (profile/hours/service periods/occasions/team) | Implemented         | `src/app/api/ops/restaurants/[id]/route.ts`, routes in build output                                                                                 | Includes interval/duration/buffers/grace                   |
| Admin/Ops | Table inventory management                                         | Implemented         | `src/app/app/(app)/settings/tables/page.tsx`, `/api/ops/tables*` (build output)                                                                     | Table list + editing flows                                 |
| Admin/Ops | Zones & adjacency                                                  | Implemented         | `backups/public_tables.sql` (`zones`, `table_adjacencies`), `/api/ops/zones*`                                                                       | Supports merge/zone rules                                  |
| Admin/Ops | Manual table assignment UI                                         | Implemented         | `src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`, `src/app/api/ops/bookings/[id]/tables/route.ts`            | Conflict/holds validation                                  |
| Admin/Ops | Table timeline view                                                | Implemented         | `src/app/api/ops/tables/timeline/route.ts`                                                                                                          | Member-gated                                               |
| Admin/Ops | Walk-in booking create                                             | Implemented         | `src/app/api/ops/bookings/route.ts`, `docs/optional-contact-fields.md`                                                                              | Email OR phone allowed                                     |
| Admin/Ops | No-show / check-in / check-out lifecycle                           | Implemented         | ops routes in build output; UI `src/components/features/dashboard/booking-details/BookingDialog.tsx`                                                | Uses `reservation_lifecycle_grace_minutes`                 |
| System    | Capacity enforcement at booking create                             | Implemented         | `server/capacity/transaction.ts`, `supabase/migrations/CONSOLIDATED_ALL_MIGRATIONS.sql`                                                             | RPC locks capacity rules; returns retryable conflicts      |
| System    | Concurrency safety for allocations                                 | Implemented         | `supabase/migrations/20260117_add_soft_holds.sql`                                                                                                   | Soft-holds + exclusion constraint                          |
| System    | Booking history/audit trail                                        | Implemented         | `server/bookings.ts` (`logAuditEvent`), `src/components/features/booking/detail/ReservationHistory.tsx`                                             | UI shows field diffs                                       |
| System    | Email notifications (confirm/reminders/updates/cancel)             | Implemented         | `server/queue/email.ts`, `src/app/api/cron/process-emails/route.ts`                                                                                 | BullMQ queue + cron processor                              |
| System    | SMS notifications                                                  | Missing             | `docs/optional-contact-fields.md`                                                                                                                   | Explicitly notes “No SMS notifications”                    |
| System    | Payments/deposits                                                  | Missing/Partial     | `src/components/features/dashboard/booking-details/components/GuestProfilePanel.tsx`                                                                | Deposit appears as optional detail only                    |
| System    | Rate limiting                                                      | Implemented         | `server/security/rate-limit.ts`, `src/app/api/availability/route.ts`                                                                                | 20/min per restaurant/ip for availability                  |
| System    | CSRF token utilities                                               | Implemented/Partial | `server/security/csrf.ts`                                                                                                                           | Requires enforcement audit                                 |
| System    | Cron job auth                                                      | Partial/Risky       | `src/app/api/cron/process-emails/route.ts`, `src/app/api/cron/auto-complete-bookings/route.ts`                                                      | Warns unprotected if `CRON_SECRET` unset                   |

## 3) MVP baseline for a table booking app (explicit)

### Customer-side MVP

- Browse restaurants + basic info (hours, location, cuisine-style metadata).
- Party size + date/time selection.
- Real availability (slot gen or table-based allocation).
- Create reservation (guest or logged-in) with idempotency.
- Confirmation page + booking reference.
- Email confirmation + at least one reminder.
- Modify/cancel within policy window with clear messaging.
- Basic validation (contact info, party limits, time constraints).

### Restaurant/Admin MVP

- Admin login + basic roles (owner/admin).
- Restaurant settings: timezone, hours, slot length, lead time/cutoffs.
- Table management: sizes, zones, combinability/adjacency rules.
- Reservation list + search + filters.
- Manual create/edit/cancel reservation.
- Capacity controls: pacing/max covers per slot/day + blackout dates.
- Notes/preferences/allergies.
- Minimal waitlist workflow (even if manual).

### System MVP

- Correct timezone handling across UI/API/DB.
- Concurrency safety: prevent double booking under load (DB constraints/transactions).
- Audit log for booking changes.
- Stable error handling and user-friendly errors.
- Basic observability (structured logs + minimal metrics events).
- Backups/migrations strategy.

## 4) Gap analysis

### A) Missing MVP features (prioritized backlog)

| Missing item                        | Why it matters                           | Where it should live | Suggested design                                                                | Complexity | Dependencies / risk                    | Priority |
| ----------------------------------- | ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ---------- | -------------------------------------- | -------- |
| Real env template (`.env.example`)  | Onboarding/runbook blocker               | Docs/config          | Fill placeholders for required vars; link to `docs/environments.md`             | S          | Low                                    | P0       |
| Cron fail-closed policy             | Prevents unauthorized job execution      | API routes           | In prod, require `CRON_SECRET`; alert if missing                                | S/M        | Medium (deployment discipline)         | P0       |
| Customer waitlist join flow         | Converts demand when fully booked        | API + UI             | Add `/api/waitlist` + UI CTA; reuse `waiting_list` table and `addToWaitingList` | M          | Must confirm RLS/GRANTS                | P1       |
| Day availability (“slots for date”) | Core booking UX                          | API + UI             | Extend `/api/availability` to return time slots for date range                  | M          | Needs service periods + interval logic | P1       |
| SMS notifications                   | Reduces no-shows                         | Jobs + provider      | Add provider integration behind flag; start ops-only                            | M          | Deliverability + privacy               | P1       |
| Deposits/preauth                    | Business requirement for no-show control | Backend + UI         | Stripe preauth/deposit policy; tie to cancel windows                            | L          | Payments/regulatory + edge cases       | P1       |

### B) Weak/partial implementations

| Feature                                               | Current status | Risk level | Recommended fix                                          | Priority |
| ----------------------------------------------------- | -------------- | ---------- | -------------------------------------------------------- | -------- |
| Availability API supports only “time-required” checks | Partial        | Medium     | Implement date-slot listing response (not just per-time) | P1       |
| Cron auth depends on env hygiene                      | Partial        | High       | Fail closed in prod when missing `CRON_SECRET`           | P0       |
| Waitlist existence without clear product surface      | Partial        | Medium     | Add API/UI; verify RLS and indexing                      | P1       |
| Lint warnings in backend hot paths (`any`)            | Partial        | Low/Med    | Remove `any` in security/capacity paths, tighten types   | P2       |

## 5) Quality & engineering improvements (Top 20)

1. Populate `.env.example` (High impact, S) — `.env.example`, `README.md`.
2. Fix sitemap base URL (High, S) — `next-sitemap.config.js` (build output shows `shipfa.st`).
3. Make cron endpoints fail-closed in prod if `CRON_SECRET` absent (High, S/M) — `src/app/api/cron/*`.
4. Add customer waitlist endpoint + UI entrypoint (High, M) — reuse `server/bookings.ts:addToWaitingList`.
5. Implement “day-slot availability” response (High, M) — `src/app/api/availability/route.ts`.
6. Audit and lock down `waiting_list` RLS/GRANTS (High, M) — follow `table_soft_holds` lockdown pattern.
7. Add more explicit indexes for ops query patterns (Medium, M) — `src/app/api/ops/bookings/route.ts`.
8. Standardize booking status nomenclature in docs vs code (Medium, S) — `docs/BUSINESS_LOGIC.md` vs `lib/enums.ts`.
9. Ensure all write endpoints accept/emit idempotency keys (High, S) — existing pattern in `src/app/api/bookings/route.ts`.
10. Reduce noisy logging; keep structured logs with correlation IDs (Medium, S).
11. Add DST-specific scheduling tests (Medium, M) — schedule + RPC conversions.
12. Add retries + DLQ reporting for email queue processing (Medium, M) — `server/queue/email.ts`, `src/app/api/cron/process-emails/route.ts`.
13. Add “retryable conflict” UI messaging when capacity/table conflicts occur (Medium, M).
14. Expand ESLint scope to include `src/**` and `reserve/**` consistently (Medium, S) — `package.json`.
15. Add runbook for “capacity rules” management (Medium, S) — `restaurant_capacity_rules` exists.
16. Harden session recovery token handling and monitoring (Medium, S/M) — `src/app/(public)/bookings/recover/route.ts`.
17. Confirm CSRF enforcement coverage in all cookie-auth writes (Medium, M) — `server/security/csrf.ts`.
18. Observability dashboards for rate limiting + booking conflicts (Medium, M) — `server/observability`.
19. Docs cleanup + conflict resolution policies (Medium, S) — `docs/DATABASE_MIGRATIONS.md`.
20. Secure table-level access for sensitive tables (High, M) — compare backups vs migrations.

## 6) Table-booking edge case QA test matrix

| Scenario                       | Steps                                  | Expected result                                            | Where it might break                            |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| Double booking same table/time | Two concurrent creates same window     | One succeeds; other returns retryable conflict; no overlap | DB constraints/holds/allocation                 |
| Capacity exceeded              | Fill to max covers then create another | Clear `CAPACITY_EXCEEDED`                                  | `create_booking_with_capacity_check` RPC        |
| Soft-hold race                 | Two sessions acquire hold same window  | Only one acquired                                          | `table_soft_holds_no_overlap`                   |
| Closed day exception           | Mark date closed; attempt booking      | Rejected as closed                                         | operating hours rules in RPC/schedule           |
| DST spring forward             | Book during missing local time         | Consistent handling; no off-by-1h                          | timezone conversions (Luxon + make_timestamptz) |
| DST fall back                  | Book during repeated hour              | Consistent disambiguation                                  | same                                            |
| Last seating vs closing        | Book near end of service               | Buffer/cutoff enforced                                     | restaurant config buffers                       |
| Modify near start              | Edit within cutoff window              | Blocked with clear message                                 | `src/app/api/bookings/[id]/route.test.ts`       |
| Cancel near start              | Cancel within cutoff                   | Blocked                                                    | same                                            |
| No-show lifecycle grace        | Mark no-show after grace               | Block/allowed per policy                                   | ops lifecycle endpoints                         |
| Email job processing           | Simulate queue backlog                 | Process batches; no duplicate sends                        | `src/app/api/cron/process-emails/route.ts`      |
| Cron unauthorized              | Call cron without bearer               | 401 when `CRON_SECRET` set                                 | `src/app/api/cron/*`                            |
| Waitlist duplicate join        | Same contact joins twice               | Upsert/unique semantics                                    | `server/bookings.ts`, DB unique idx             |
| Ops membership leak            | Non-member hits booking detail         | 404/Forbidden without leakage                              | `src/app/api/ops/bookings/[id]/route.test.ts`   |

## 7) Suggested 2–4 week MVP completion plan

### Week 1 (P0 hygiene + unblock ops)

- Populate `.env.example` with placeholders + required vars.
- Resolve `docs/DATABASE_MIGRATIONS.md` conflicts.
- Fix sitemap base URL config (`next-sitemap.config.js`).
- Enforce cron fail-closed in production if `CRON_SECRET` missing.

### Week 2 (Customer availability + waitlist baseline)

- Extend `/api/availability` to return per-day slot grid.
- Add `/api/waitlist` and minimal UI entrypoint; reuse `server/bookings.ts:addToWaitingList`.

### Week 3 (Reliability hardening)

- Audit and lock down `waiting_list` RLS/GRANTS (if needed).
- Add DST/edge-case tests and verify cutoff/policy messaging.

### Week 4 (Optional: monetization + comms)

- Add SMS provider behind a flag (start ops-only reminders).
- Scope and implement deposits/preauth if required.

## Notes on external best practices (citations)

- Postgres Exclusion Constraints for non-overlapping reservations: PostgreSQL docs — `EXCLUDE USING gist`.
  - https://www.postgresql.org/docs/current/ddl-constraints.html
  - https://www.postgresql.org/docs/current/rangetypes.html
- Postgres Serializable isolation and retry-on-40001 for concurrency anomalies:
  - https://www.postgresql.org/docs/current/transaction-iso.html
- Postgres advisory locks (when MVCC fit is awkward):
  - https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS
