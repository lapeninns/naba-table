# Waterbeach Seeds — Quick Reference

| Task                           | Command                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Full refresh (truncate + seed) | `pnpm run db:reset`                                                                             |
| Seed Waterbeach fixtures only  | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/white-horse-service-periods.sql`  |
| Cleanup stray restaurants      | `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/cleanup-keep-only-waterbeach.sql` |

## Environment

```bash
source .env.local
export SUPABASE_DB_URL=postgresql://... # remote only
```

## Files

1. **`white-horse-service-periods.sql`**
   - Seeds the single supported venue.
   - Safe to re-run to repair service periods or table inventory.

2. **`cleanup-keep-only-waterbeach.sql`**
   - Defensive cleanup to delete any non-White-Horse data that might have been introduced by legacy scripts.

## Tips

- Always run `pnpm run db:migrate` after pulling new migrations before seeding.
- Capture a snapshot (`pg_dump`) before running cleanup scripts on shared environments.
- If you need to adjust contact details or operating hours, edit `supabase/seed.sql` directly and re-run `pnpm run db:seed-only`.
