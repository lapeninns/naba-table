-- Seed: Table inventory for all restaurants
-- Source: tasks/seed-restaurant-tables-20251016-1251

BEGIN;

-- Ensure deterministic timestamps when run locally
SET TIME ZONE 'UTC';

WITH restaurants_to_seed AS (
    SELECT r.id
    FROM public.restaurants r
),
table_blueprint AS (
    SELECT
        r.id AS restaurant_id,
        ('T' || lpad(gs::text, 2, '0')) AS table_number,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 6
            ELSE 8
        END AS capacity,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 1
            WHEN gs BETWEEN 5 AND 10 THEN 2
            WHEN gs BETWEEN 11 AND 14 THEN 4
            ELSE 6
        END AS min_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 4 THEN 2
            WHEN gs BETWEEN 5 AND 10 THEN 4
            WHEN gs BETWEEN 11 AND 14 THEN 6
            ELSE 8
        END AS max_party_size,
        CASE
            WHEN gs BETWEEN 1 AND 8 THEN 'Main Floor'
            WHEN gs BETWEEN 9 AND 12 THEN 'Patio'
            WHEN gs BETWEEN 13 AND 14 THEN 'Bar High-Tops'
            ELSE 'Private Room'
        END AS section,
        CASE
            WHEN gs BETWEEN 1 AND 8 THEN 'indoor'::public.seating_type
            WHEN gs BETWEEN 9 AND 12 THEN 'outdoor'::public.seating_type
            WHEN gs BETWEEN 13 AND 14 THEN 'bar'::public.seating_type
            ELSE 'private_room'::public.seating_type
        END AS seating_type,
        'available'::public.table_status AS status,
        jsonb_build_object(
            'x', ((gs - 1) % 4) * 150,
            'y', ((gs - 1) / 4) * 150
        ) AS position
    FROM restaurants_to_seed r
    CROSS JOIN generate_series(1, 16) AS gs
),
upserted AS (
    INSERT INTO public.table_inventory (
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        seating_type,
        status,
        position
    )
    SELECT
        restaurant_id,
        table_number,
        capacity,
        min_party_size,
        max_party_size,
        section,
        seating_type,
        status,
        position
    FROM table_blueprint
    ON CONFLICT (restaurant_id, table_number) DO UPDATE
    SET
        capacity = EXCLUDED.capacity,
        min_party_size = EXCLUDED.min_party_size,
        max_party_size = EXCLUDED.max_party_size,
        section = EXCLUDED.section,
        seating_type = EXCLUDED.seating_type,
        updated_at = now()
    RETURNING 1
)
SELECT count(*) AS seeded_or_updated_tables
FROM upserted;

COMMIT;
