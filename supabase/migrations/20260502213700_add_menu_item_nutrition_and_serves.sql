BEGIN;

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS calories_kcal integer,
  ADD COLUMN IF NOT EXISTS protein_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fat_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS carbs_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS sugar_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fiber_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric(8, 2),
  ADD COLUMN IF NOT EXISTS serves_num integer;

ALTER TABLE public.restaurant_drink_menu_items
  ADD COLUMN IF NOT EXISTS calories_kcal integer,
  ADD COLUMN IF NOT EXISTS protein_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fat_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS carbs_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS sugar_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fiber_g numeric(6, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric(8, 2),
  ADD COLUMN IF NOT EXISTS serves_num integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_calories_kcal_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_calories_kcal_check
      CHECK (calories_kcal IS NULL OR calories_kcal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_menu_items_serves_num_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_serves_num_check
      CHECK (serves_num IS NULL OR serves_num >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_drink_menu_items_calories_kcal_check'
      AND conrelid = 'public.restaurant_drink_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_drink_menu_items
      ADD CONSTRAINT restaurant_drink_menu_items_calories_kcal_check
      CHECK (calories_kcal IS NULL OR calories_kcal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_drink_menu_items_serves_num_check'
      AND conrelid = 'public.restaurant_drink_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_drink_menu_items
      ADD CONSTRAINT restaurant_drink_menu_items_serves_num_check
      CHECK (serves_num IS NULL OR serves_num >= 0);
  END IF;
END
$$;

COMMIT;
