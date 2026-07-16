# ULW-Research Synthesis: Booking close, last seating, and duration

Workers: 7 lanes · Waves: 3 · Primary external domains: 4+ · Executed verification groups: 4

## Executive summary

The supplied diagnosis is correct, with one important historical nuance: this is not simply an unfinished feature. Nabatable originally implemented finish-by-close filtering in October 2025, deliberately removed it in March 2026 so configured service starts were authoritative, then restored end-before-close only in unified creation during May security hardening and hard-enabled that validator in June. The two intentional policies now coexist and contradict each other. [S1] [S2] [S3]

Current guest availability is party-agnostic and duration-agnostic. The public schedule accepts only a date, slot generation checks start-time membership, and the guest query key contains no party size. The last-seating buffer is read and returned but not consumed. Creation later resolves the restaurant/booking-option/party-size turn band and rejects the booking if its end is after the effective operating close. [S4] [S5] [S6]

Under the user’s stated finish-by-close intent and the current Ops tooltip, the recommended rule is:

```text
eligible =
  configured candidate is active for the service
  AND startAt + resolvedPartyDuration <= effectiveOperatingCloseAt
  AND startAt + lastSeatingBuffer <= effectiveOperatingCloseAt
```

For a same-day window, this is equivalent to:

```text
latestStart = close - max(resolvedPartyDuration, lastSeatingBuffer)
```

Equality is allowed. Do not subtract `duration + lastSeatingBuffer`; the setting is a latest-seating lead, not a cleanup period. Tock and Tablein support duration-derived last starts, while Yelp and TableGo show that last seating and party-size turn time are separate constraints. [S7] [S8] [S9] [S10]

## What is broken now

### 1. Plan and create apply different rules

- Generic schedule candidates are generated from fixed slots or `[open, close)` interval starts, then restricted to service-period membership and occasion enablement. Duration, party size, turn bands, and last-seating buffer do not enter `computeSlots`. [S4]
- The guest request and React Query key use slug/date, not party size. [S5]
- Unified create is always enabled. It resolves duration server-side and rejects `end > schedule.window.closesAt` before the atomic capacity mutation. [S2] [S6]
- Existing tests intentionally lock both sides: one accepts a listed 21:30 start even when duration would exceed 22:00; another requires unified validation to reject end-after-close. [S1] [S2]

Executed verification reproduced the mismatch and confirmed that capacity mutation is not consulted after the timing failure. [V1]

### 2. Last-seating buffer is a dead availability setting

`reservation_last_seating_buffer_minutes` is persisted through Ops, selected by the schedule, returned publicly, and normalized by the guest client. It has no current availability or create-validation consumer. The operator tooltip still says it stops seating before close so guests can finish. [S4] [S11]

The field’s runtime behavior therefore contradicts its name, current copy, database history, and original implementation.

### 3. Turn duration is applied too late

Create resolves duration using:

1. selected schedule booking option;
2. restaurant turn-band overrides;
3. the first party-size band that covers the party, or the largest band;
4. built-in service bands as fallback. [S6]

The guest schedule has none of that context. The wizard copies `schedule.defaultDurationMinutes` into presentation state, so confirmation display can also differ from the server-created booking duration. [S5] [S11]

### 4. Fixed slots do not justify late overruns

Fixed slots already override interval cadence only. They are filtered by operating range and service-period membership. They should be treated as candidate starts subject to the same duration and last-seating eligibility rule, not as waivers of the non-overridable create boundary. [S4] [S12]

### 5. Alternatives have the same duration drift

`findAlternativeSlots` accepts `durationMinutes`, but omits it when calling aggregate availability evaluation. That evaluation falls back to the scalar schedule default, so a rejected longer booking can receive an alternative evaluated with a shorter duration. [S13]

## Recommended implementation architecture

### A. Preserve the generic schedule

Do not make `getRestaurantSchedule()` party-specific. It has many internal consumers and should remain the configuration-derived candidate schedule used by validation, capacity context, Ops timelines, and edits. [S4] [S12]

### B. Add a server-owned party-aware guest projection

Add an optional, validated `party` query to the public restaurant schedule route and compose:

```text
generic candidate schedule
  + party size
  + one preloaded restaurant turn-band query
  + shared online-window decision
  -> guest-eligible slots with durationMinutes
```

The projection should:

- load turn bands once, not once per slot;
- resolve each slot using its known `bookingOption` and the same duration resolver as create;
- apply both buffer and duration constraints;
- apply the same maximum-duration and same-day rules as online create;
- filter interval and fixed candidates identically;
- return the resolved `durationMinutes` for guest display;
- fail closed if duration policy cannot be loaded.

Recommended module boundary:

- leaf pure decision module, e.g. `server/booking/online-booking-window.ts`;
- composition module, e.g. `server/restaurants/guestBookingSchedule.ts`.

Keep the leaf independent of schedule, capacity, and barrel imports to avoid circular dependencies. [S12]

### C. Reuse the same decision in create

`BookingValidationService` should map the shared decision into its existing error codes and preserve non-overridable end-after-close behavior. After the precommit schedule selects the booking option and duration is resolved, apply the full eligibility decision before customer/idempotency/capacity work where practical; unified validation still repeats it against current configuration before mutation.

Keep distinct reasons internally:

- `LAST_SEATING_CUTOFF`
- `END_AFTER_CLOSE`
- `INVALID_DURATION`
- `DURATION_TOO_LONG`
- `CROSS_DATE`
- `OVERNIGHT_UNSUPPORTED`

This improves observability without changing the core rule.

### D. Make the guest cache party-aware

- Add party to the request URL and `scheduleQueryKey`.
- Remove `keepPreviousData` for this query, or return `evaluatedPartySize` and suppress slots/Continue until it matches the current party.
- Clear or replace a selected slot when party changes make it ineligible.
- Set presentation duration from the selected projected slot, not the scalar default.

Because party is in the public URL, CDN cache variation remains safe and contains no PII. [S5] [S12]

### E. Fix alternative duration propagation

Pass `durationMinutes` into each alternative candidate’s aggregate evaluation. Continue to resolve authoritative duration server-side; do not trust a client duration.

## Boundary examples

For a 22:00 effective operating close:

| Resolved duration | Last-seating buffer | Latest eligible start |
| ----------------: | ------------------: | --------------------: |
|               90m |                 15m |                 20:30 |
|               60m |                120m |                 20:00 |
|              120m |                 60m |                 20:00 |

`20:30 + 90m = 22:00` is accepted. `20:31 + 90m` is rejected. A fixed 20:10 start can remain eligible if both constraints pass; a fixed 20:30 start cannot override a 20:00 cutoff.

## Important separate defect: overnight service

The base schedule supports close-at-midnight and close-after-midnight ranges, but the rest of the system does not:

- guest filtering interprets after-midnight times on the wrong date;
- start validation uses scalar same-day comparisons;
- unified validation rejects cross-calendar-day ends and parses `00:00` on the opening date;
- the SQL RPC constructs start and end on the same booking date;
- alternative ordering uses raw clock minutes. [S4] [S6] [S14]

Immediate safe behavior: return no guest-eligible slots for overnight windows, with an explicit unsupported reason, while leaving generic schedules available for Ops. Full support requires a separate logical-service-date and absolute-instant migration across API, application, capacity, and SQL.

Do not claim full Plan/Create consistency for overnight venues until that project is complete.

## Database boundary

The current atomic RPC protects capacity mutation, but repository-visible SQL checks only the start against operating hours. End-before-close is currently an application invariant, not a database invariant. A schedule change between validation and commit remains a race. [S14]

The party-aware projection does not weaken capacity safety. If transactional finish-by-close is required, harden the RPC separately on staging using the same effective-hours/end rule.

## Required tests

Minimum regression set:

1. Same candidate, party 2/60m is visible and party 8/90m is hidden.
2. End exactly at close passes; one minute after fails.
3. Buffer smaller/equal/larger than duration uses `max`, not addition.
4. Fixed and interval candidates receive identical filtering.
5. Date override close is used.
6. Party change cannot submit placeholder slots from the previous query.
7. Selected projected duration matches confirmation display; create independently resolves the same duration.
8. Direct POST of a now-hidden late slot still returns `OUTSIDE_HOURS` and performs no mutation.
9. Alternative search forwards duration.
10. Overnight public projection fails closed until migrated.
11. One turn-band query, zero per-slot option/band queries.
12. Projection failure never falls back to unfiltered candidates.

Before handoff, run the narrow suites, then `pnpm verify`, production build, and browser proof on the guest route.

## Contradictions resolved

- **October finish-by-close vs March configured-start policy:** the user’s requested intent, current tooltip, and hard-enabled create safety select finish-by-close. The March behavior must be explicitly superseded, and its late-slot regression updated rather than silently worked around.
- **Buffer vs duration:** both apply independently; the formula is `max`, not addition.
- **Operating close vs service-period end:** use effective operating close for this fix. Service periods continue to constrain allowed starts only.
- **Fixed slots vs safety:** fixed slots override cadence, not close eligibility.
- **Client vs server filtering:** server projection owns the rule.

## Gaps and external verification

- The deployed staging RPC and live column defaults were not inspected; repository evidence cannot prove remote schema parity.
- No production UI or remote API was mutated or exercised.
- Additional adjacent capacity-status/counting mismatches were identified but are outside this close-rule solution.
- User-authored concurrent changes in guest wizard files were left untouched.

## Expansion trace

- Wave 1: seven independent code/history/settings/database/external/skeptic lanes produced the current behavior map and leads.
- Wave 2: contract semantics and fixed-slot precedence were resolved.
- Wave 3: counter-search and implementation-boundary critique found no stronger alternative and closed all in-scope leads.
- Convergence: zero unchecked research leads remain; overnight and live-database work are explicit separate migrations.

## Sources

- [S1] `tests/server/bookings/timeValidation.test.ts:57-65`; commits `922dd6ce`, `21502d2b` / `ab301ac2`.
- [S2] `server/booking/BookingValidationService.ts:401-466`; `tests/server/booking-validation-security.test.ts:149-160`; `server/runtime-policy.ts:158-160`.
- [S3] Commits `6abe47a6`, `d735f546`; `wave-1-history-tests.md`.
- [S4] `server/restaurants/schedule.ts:169-205,330-483,492-512,557-605,622-640`.
- [S5] `reserve/features/reservations/wizard/services/schedule.ts:7-10,135-152`; `useTimeSlots.ts:18-22,44-64`; `usePlanStepForm.ts:990-999`.
- [S6] `server/bookings/create-precommit-context.ts:86-160`; `server/bookings/duration.ts:45-84`; `server/capacity/policy.ts:289-351`.
- [S7] Tock, https://tock.zendesk.com/hc/en-us/articles/360031223931-Setting-Reservation-Hours-and-Turn-Times-for-Blueprints, accessed 2026-07-16.
- [S8] Tablein, https://help.tablein.com/et-up-opening-hours, accessed 2026-07-16.
- [S9] Yelp, https://biz.yelp.com/support-center/article/Understanding-Yelp-Reservations-Sheets, accessed 2026-07-16.
- [S10] TableGo, https://business.tablego.uk/help-center/configure-business-hours, accessed 2026-07-16.
- [S11] `components/ops/restaurants/restaurantDetailsFormModel.ts:90-96`; `BookingRulesSubform.tsx:164-215`.
- [S12] `wave-2-code-fixed-slot-precedence.md`; `wave-3-code-implementation-boundary.md`.
- [S13] `server/capacity/types.ts:53-61`; `server/capacity/service.ts:425-432`.
- [S14] `supabase/migrations/20260124_fix_booking_rpc_day_of_week.sql:116-225`; `verify-booking-window.md`.
- [V1] `.omo/ulw-research/20260716-145039/verify-booking-window.md`.
