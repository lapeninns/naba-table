---
task: party-duration-policy
timestamp_utc: 2026-02-03T13:41:10Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [feat.reservation.turn_bands]
related_tickets: []
---

# Implementation Plan: Party-Size-Based Reservation Durations

## Objective

We will enable ops to configure per-restaurant dining duration rules by party size and service so that availability, capacity, and booking windows reflect real restaurant pacing.

## Success Criteria

- [ ] Ops can edit lunch/dinner duration rules per restaurant.
- [ ] Booking window calculation uses the per-restaurant rule set with safe defaults.
- [ ] Validation rejects invalid or overlapping rules.
- [ ] No regressions in existing booking/availability flows.

## Architecture & Components

- **Data model**: new table `restaurant_turn_bands` (restaurant_id, booking_option, max_party_size, duration_minutes, created_at, updated_at).
  - Constraints: `max_party_size > 0`, `duration_minutes BETWEEN 15 AND 300`.
  - Unique: `(restaurant_id, booking_option, max_party_size)`.
  - FK: `restaurant_id -> restaurants`, `booking_option -> booking_occasions.key` (restrict to lunch/dinner in API).
- **Server**:
  - Add `server/restaurants/turnBands.ts` to load/replace bands by restaurant.
  - Add `server/capacity/policy.ts` helper to apply overrides to `defaultVenuePolicy` (pure function).
  - Update capacity callers to pass restaurant-specific policy (load once per request where restaurant_id is known).
- **Ops API**:
  - `GET /api/ops/restaurants/[id]/turn-bands` → `{ lunch: TurnBand[], dinner: TurnBand[] }`.
  - `PUT /api/ops/restaurants/[id]/turn-bands` with same payload; validates and replaces per restaurant.
- **UI**:
  - New settings section (Restaurant Settings → Profile) to edit turn bands per service.
  - Table-like editor with rows `{ maxPartySize, durationMinutes }`, add/remove rows, sorted by maxPartySize.
  - Defaults shown from `defaultVenuePolicy` when no rows exist.

## Data Flow & API Contracts

**Request (PUT)**

```
{
  "lunch": [{ "maxPartySize": 2, "durationMinutes": 60 }],
  "dinner": [{ "maxPartySize": 2, "durationMinutes": 60 }]
}
```

**Response (GET/PUT)**

```
{
  "lunch": [{ "maxPartySize": 2, "durationMinutes": 60 }],
  "dinner": [{ "maxPartySize": 2, "durationMinutes": 60 }]
}
```

**Validation**

- Each service must have ≥1 band.
- Bands sorted by maxPartySize; duplicates rejected.
- Durations bounded (15–300 minutes).

## UI/UX States

- Loading / Empty / Error / Success
- “Defaults in use” notice when no saved bands exist.

## Edge Cases

- Missing bands → fall back to `defaultVenuePolicy`.
- Large party size beyond max band → use last band (current behavior).
- Restaurant without lunch/dinner periods still allowed (bands stored but unused).

## Testing Strategy

- Unit: policy override application + band selection ordering.
- Integration: ops API validation (bad payloads rejected).
- E2E: ops can edit and save; booking window reflects new duration.
- Accessibility: inputs labeled, errors announced.

## Rollout

- Feature flag optional; default to using overrides when present, fallback otherwise.
- Monitor capacity/assignment errors and booking window mismatches.

## DB Change Plan (if applicable)

- Target envs: staging → production (window: TBD)
- Backup reference: TBD
- Dry-run evidence: `artifacts/db-diff.txt`
- Backfill strategy: optional (not required; defaults apply when empty)
- Rollback plan: drop table + revert code to defaults
