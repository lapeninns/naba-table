# DevTools QA Notes (local)

Date: 2026-02-16

## Route coverage

- Opened: `http://localhost:3001/dev/ops-dashboard`
- Opened: `http://localhost:3001/dev/ops-bookings?restaurantId=11111111-1111-4111-8111-111111111111`

## Interaction checks

- Ops bookings list rendered in harness.
- Opened `More actions -> Edit Booking` dialog successfully.
- Dialog showed timezone context (`Europe/London`) and computed current/new times.

## Limitations observed

- Harness schedule/calendar APIs failed with 500 because local Supabase host was DNS-unreachable (`ENOTFOUND loxrwkeuxesctnrdpksy.supabase.co`).
- Because of schedule load failure, `Save changes` stayed disabled and full mutation submission could not be executed in this harness run.

## Related local logs

- `GET /api/restaurants/dev-restaurant/schedule?date=2026-02-16 -> 500`
- `GET /api/restaurants/dev-restaurant/calendar-mask?... -> 500`
- `POST /api/v1/events -> 204`
