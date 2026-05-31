# [MEDIUM] Unbounded booking duration bypasses operating-window limits

**File:** [`server/booking/BookingValidationService.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/booking/BookingValidationService.ts#L147-L398) (lines 147, 155, 200, 212, 386, 397, 398)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-business-logic-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

runValidation only rejects durationMinutes <= 0, then derives normalizedEndDateTime and normalizedEndTime from input.durationMinutes and forwards that endTime into create/update commits. The service validates that the start time is an enabled slot, but never verifies that the computed end remains within closing hours, within last-seating policy, within a sane maximum duration, same-day, or even non-wrapping once reduced to HH:mm. The public and ops booking edit routes accept endIso and convert it into durationMinutes before calling updateWithEnforcement, so a user who can edit a booking can submit an excessive endIso and create after-hours or wrapped booking windows that corrupt availability/table-allocation state.

## Recommendation

Do not trust client-derived endIso/duration. Recompute duration from restaurant policy where possible, require Number.isFinite with a strict maximum, verify normalizedEndDateTime is after start and before the schedule closing/last-seating boundary, and reject unsupported cross-day or HH:mm-wrapping windows. Add negative API tests for end-after-close and overlong-duration updates.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-20)
