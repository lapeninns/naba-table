-- init-seeds.sql
-- Loads seed data into the database
-- This file orchestrates the execution of all seed files

\echo '🌱 Loading seed data...'

\ir ../seed.sql

\echo '✅ Seed data loaded successfully!'
