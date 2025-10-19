-- init-seeds.sql
-- Loads seed data into the database
-- This file orchestrates the execution of all seed files

\echo '🌱 Loading seed data...'

-- Load the main seed data
\ir ../seeds/seed.sql

\echo '✅ Seed data loaded successfully!'
