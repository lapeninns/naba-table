# Intent vs reality

| intent_id | expected truth | observed reality | diff | violated invariant | intent source | supporting observations | status | claim ids |
|---|---|---|---|---|---|---|---|---|
| I1 | Every displayed reservation start can be confirmed for the selected party size and occasion. | Plan is date-only; Create resolves party duration and rejects end-after-close. | Violated. | Plan and Confirm must use one eligibility rule. | User-provided logic gap. | `useTimeSlots.ts:18-52`; `BookingValidationService.ts:401-466`. | violated | C1 |
| I2 | The configured last-seating buffer affects guest availability. | The value is persisted and returned but not consumed by eligibility. | Violated. | Persisted availability controls must be enforced. | User-provided logic gap. | `schedule.ts:492-512,622-640`; exhaustive reference search. | violated | C2 |
| I3 | Kitchen boundaries can be represented without necessarily adding new database columns. | `restaurant_operating_hours.opens_at` and `closes_at` are presented as kitchen boundaries by the settings UI. | No schema addition is required for this fix. | One canonical close boundary must be consistently interpreted. | Follow-up question. | `types/supabase.ts`; `WeeklyScheduleCard.tsx`. | true | C3 |
