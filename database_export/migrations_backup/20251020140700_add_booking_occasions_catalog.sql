-- Adds configurable booking occasion catalogue and enforces FK from restaurant_service_periods.

BEGIN;
CREATE TABLE IF NOT EXISTS public.booking_occasions (
    key text PRIMARY KEY,
    label text NOT NULL,
    short_label text NOT NULL,
    description text,
    availability jsonb NOT NULL DEFAULT '[]'::jsonb,
    default_duration_minutes smallint NOT NULL DEFAULT 90,
    display_order smallint NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.booking_occasions (key, label, short_label, description, availability, default_duration_minutes, display_order)
VALUES
    (
        'lunch',
        'Lunch',
        'Lunch',
        'Midday dining experience.',
        '[{"kind":"time_window","start":"11:30","end":"15:30"}]'::jsonb,
        90,
        10
    ),
    (
        'dinner',
        'Dinner',
        'Dinner',
        'Evening dining service.',
        '[{"kind":"time_window","start":"17:00","end":"23:00"}]'::jsonb,
        120,
        20
    ),
    (
        'drinks',
        'Drinks & Cocktails',
        'Drinks',
        'Bar reservations and lounge experiences available throughout operating hours.',
        '[{"kind":"anytime"}]'::jsonb,
        75,
        30
    ),
    (
        'christmas_party',
        'Christmas Party',
        'Christmas',
        'Festive group celebration packages available only during December.',
        '[{"kind":"month_only","months":[12]}]'::jsonb,
        150,
        40
    ),
    (
        'curry_and_carols',
        'Curry & Carols',
        'Curry & Carols',
        'Limited seasonal evenings pairing curry feasts with live carols.',
        '[{"kind":"specific_dates","dates":["2025-12-15","2025-12-22"]}]'::jsonb,
        150,
        50
    )
ON CONFLICT (key) DO UPDATE
SET
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    default_duration_minutes = EXCLUDED.default_duration_minutes,
    display_order = EXCLUDED.display_order,
    is_active = true,
    updated_at = now();
ALTER TABLE public.restaurant_service_periods
    DROP CONSTRAINT IF EXISTS restaurant_service_periods_booking_option_check;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'restaurant_service_periods_booking_option_fkey'
          AND table_name = 'restaurant_service_periods'
    ) THEN
        ALTER TABLE public.restaurant_service_periods
            ADD CONSTRAINT restaurant_service_periods_booking_option_fkey
            FOREIGN KEY (booking_option)
            REFERENCES public.booking_occasions (key)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END $$;
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_booking_type_fkey;
ALTER TABLE public.bookings
    ALTER COLUMN booking_type DROP DEFAULT,
    ALTER COLUMN booking_type TYPE text USING booking_type::text;
-- Map legacy booking types to the new catalogue before FK enforcement.
UPDATE public.restaurant_service_periods
SET booking_option = 'lunch'
WHERE booking_option::text IN ('breakfast', 'brunch');
UPDATE public.bookings
SET booking_type = 'lunch'
WHERE booking_type::text IN ('breakfast', 'brunch');
-- Clean up any stray null/empty booking types.
UPDATE public.bookings
SET booking_type = 'dinner'
WHERE booking_type IS NULL OR trim(booking_type) = '';
ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_booking_type_fkey
        FOREIGN KEY (booking_type)
        REFERENCES public.booking_occasions (key)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
ALTER TABLE public.bookings
    ALTER COLUMN booking_type SET DEFAULT 'dinner';
DROP TYPE IF EXISTS public.booking_type;
COMMIT;
