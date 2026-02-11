# Command Summary

## Clone restaurant config (dry run)

```bash
SOURCE_SLUG=the-railway-pub TARGET_NAME='Three Horseshoes' pnpm -s tsx scripts/seed-railway-from-cornerhouse.ts
```

## Clone restaurant config (production apply)

```bash
CONFIRM_PRODUCTION=true EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm SOURCE_SLUG=the-railway-pub TARGET_NAME='Three Horseshoes' OWNER_USER_ID=178310d1-0592-4f90-98ab-9cecb67f15de pnpm -s tsx scripts/seed-railway-from-cornerhouse.ts --apply
```

## Overwrite restaurant profile fields

- Applied via service-role update on `restaurants.id = 3a300e1c-5b91-4637-ae27-514863cad5ad`.

## Seed bookings

- Seeded synthetic data for 15 future days (`2026-02-12` to `2026-02-26`) with 40-50 bookings/day.
- Insert path: `customers` -> `bookings` -> `booking_table_assignments`.

## Verification

- Daily distribution and totals captured in `booking-counts.json`.
