-- init-seeds-waterbeach.sql
-- Loads minimal seed data (booking occasions catalog + White Horse Pub only)
-- This file is used for a clean Waterbeach-only setup

\echo '🌱 Loading Waterbeach-only seed data...'

-- First, load booking occasions catalog (required for service periods to work)
BEGIN;

INSERT INTO public.booking_occasions (key, label, short_label, description, availability, default_duration_minutes, display_order, is_active, created_at, updated_at)
VALUES
    (
        'lunch',
        'Lunch',
        'Lunch',
        'Midday dining experience with hearty pub classics.',
        '[{"kind":"time_window","start":"11:45","end":"15:30"}]'::jsonb,
        90,
        10,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'drinks',
        'Drinks & Cocktails',
        'Drinks',
        'Bar reservations, cocktails, and casual catch-ups.',
        '[{"kind":"time_window","start":"15:00","end":"23:30"}]'::jsonb,
        60,
        20,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    ),
    (
        'dinner',
        'Dinner',
        'Dinner',
        'Evening service featuring signature dishes.',
        '[{"kind":"time_window","start":"17:00","end":"23:00"}]'::jsonb,
        120,
        30,
        true,
        timezone('utc', now()),
        timezone('utc', now())
    )
ON CONFLICT (key) DO UPDATE
SET 
    label = EXCLUDED.label,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc', now());

COMMIT;

\echo '  ✓ Booking occasions catalog loaded'

-- Load White Horse Pub
\ir ../seeds/white-horse-service-periods.sql

\echo '✅ Waterbeach-only seed data loaded successfully!'
