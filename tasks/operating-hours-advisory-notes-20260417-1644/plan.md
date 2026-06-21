---
task: operating-hours-advisory-notes
timestamp_utc: 2026-04-17T16:44:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Operating Hours Advisory Notes

## Objective

We will surface operating-hours notes in the reserve booking wizard's info alert so guests see venue-specific availability guidance for the selected date when that note exists.

## Success Criteria

- [ ] The plan-step info alert shows the effective operating-hours note for the selected date when `notes` is populated.
- [ ] Weekend and override-date selections without notes still show the existing fallback advisory copy.
- [ ] Focused automated tests cover the new advisory precedence and schedule payload normalization.

## Architecture & Components

- `server/restaurants/schedule.ts`: include the effective operating-hours `notes` in the public schedule contract.
- `reserve/features/reservations/wizard/services/timeSlots.ts`: extend the reserve schedule type with a nullable `notes` field.
- `reserve/features/reservations/wizard/services/schedule.ts`: normalize the nullable `notes` field from the API payload.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts`: derive the advisory from schedule notes first, then existing fallback logic.

## Data Flow & API Contracts

Endpoint: `GET /api/restaurants/:slug/schedule?date=YYYY-MM-DD`

Response addition:

```ts
{
  notes: string | null;
}
```

Behavior:

- `notes` comes from the effective operating-hours row already chosen by the schedule service.
- The client trims and treats empty-string notes as `null`.

## UI/UX States

- Loading: unchanged.
- Success with note: alert displays the note text.
- Success without note on weekend/override date: alert displays the existing generic advisory.
- Success without note on ordinary weekday: no alert.

## Edge Cases

- Whitespace-only notes should not render as an empty alert.
- Override rows with notes should win over weekly notes for the selected date because the schedule service already prefers the override row.

## Testing Strategy

- Unit: extend plan-step advisory tests for note precedence and weekday note visibility.
- Unit: extend schedule normalization tests for `notes`.
- Manual UI proof: verify the alert content in the booking flow with Chrome DevTools using an existing or dev verification surface.

## Rollout

- No feature flag required.
- Monitoring: none beyond focused verification because this is a scoped presentation fix.
- Kill-switch: revert the small schedule/advisory change if unexpected UI regressions appear.
