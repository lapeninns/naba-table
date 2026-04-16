# Continuity Ledger

Last updated: 2026-04-15T16:54:06Z

## Goal (incl. success criteria)

- Update production manager notification phone numbers for four pub restaurant rows.
- Success: Railway Pub and White Horse Pub store `+447886700798`.
- Success: Old Crown Girton stores `+447886213624`.
- Success: Corner House Pub stores `+447476415818`.

## Constraints/Assumptions

- Follow root `AGENTS.md`.
- Use the production remote Supabase path only.
- Preserve the canonical `E.164` manager phone format expected by the ops restaurant API.

## Key decisions

- Use `restaurants.manager_notification_phone` as the canonical field for manager SMS routing.
- Normalize user-supplied UK mobile numbers before writing production data.
- Keep the change scoped to the four requested active pub rows only.

## State

- Task folder created at `tasks/update-manager-notification-phones-20260415-1654/`.
- Confirmed the canonical validation/storage path:
  - `src/app/api/ops/restaurants/schema.ts`
  - `server/restaurants/update.ts`
- Confirmed current production values for the four target pubs all point at the old shared number.
- Confirmed requested numbers normalize to:
  - Railway / White Horse: `+447886700798`
  - Old Crown: `+447886213624`
  - Corner House: `+447476415818`

## Done

- Created the task artifacts for this production data change.
- Collected the production row snapshot and phone normalization proof before applying the update.
- Updated the four production rows and saved the before/after snapshot in `artifacts/manager-notification-phone-update.json`.

## Now

- Final pass on the task notes and user handoff.

## Next

- Share the verified new manager numbers with the user.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/update-manager-notification-phones-20260415-1654/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/update-manager-notification-phones-20260415-1654/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/update-manager-notification-phones-20260415-1654/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/update-manager-notification-phones-20260415-1654/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/update-manager-notification-phones-20260415-1654/artifacts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/ops/restaurants/schema.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/restaurants/update.ts
