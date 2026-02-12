# Commands

## Dry Run (No Writes)

```bash
RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts
```

## Apply (Destructive)

```bash
CONFIRM_PRODUCTION=true CONFIRM_PURGE_BOOKINGS=true EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm RESTAURANT_SLUG=three-horseshoes \
  pnpm -s tsx scripts/purge-restaurant-bookings.ts --apply
```

## Post-Check (No Writes)

```bash
RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts
```
