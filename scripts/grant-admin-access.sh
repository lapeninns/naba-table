#!/bin/bash
# Grant admin access to amanshresthaaaaa@gmail.com for all restaurants
# Run this after the user has signed up via Supabase Auth

echo "Granting admin access to amanshresthaaaaa@gmail.com..."

# Get the database URL from supabase CLI
DB_PROJECT_REF=$(cat supabase/.temp/project-ref 2>/dev/null)

if [ -z "$DB_PROJECT_REF" ]; then
  echo "Error: Could not find project ref. Make sure you're linked to a Supabase project."
  exit 1
fi

# Run the SQL script
cat supabase/seeds/grant-admin-access.sql | supabase db execute --linked

echo "Done! Check the output above for success message."
