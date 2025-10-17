#!/bin/sh
set -e

# Run Supabase migrations (remote only)
supabase db push

# Run all seed files in order
supabase db execute ./supabase/seeds/seed.sql
supabase db execute ./supabase/seeds/20251009183743_seed_today_bookings.sql
supabase db execute ./supabase/seeds/manual/seed-table-inventory.sql

echo "Migrations and seeds applied successfully."
