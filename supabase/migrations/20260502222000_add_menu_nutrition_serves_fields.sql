BEGIN;

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS calories_kcal integer,
  ADD COLUMN IF NOT EXISTS protein_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS fat_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS carbs_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS sugar_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS fiber_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric(10, 2),
  ADD COLUMN IF NOT EXISTS serves_num integer;

ALTER TABLE public.restaurant_drink_menu_items
  ADD COLUMN IF NOT EXISTS calories_kcal integer,
  ADD COLUMN IF NOT EXISTS protein_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS fat_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS carbs_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS sugar_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS fiber_g numeric(10, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg numeric(10, 2),
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
    WHERE conname = 'restaurant_menu_items_nutrition_nonnegative_check'
      AND conrelid = 'public.restaurant_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_menu_items
      ADD CONSTRAINT restaurant_menu_items_nutrition_nonnegative_check
      CHECK (
        (protein_g IS NULL OR protein_g >= 0)
        AND (fat_g IS NULL OR fat_g >= 0)
        AND (saturated_fat_g IS NULL OR saturated_fat_g >= 0)
        AND (carbs_g IS NULL OR carbs_g >= 0)
        AND (sugar_g IS NULL OR sugar_g >= 0)
        AND (fiber_g IS NULL OR fiber_g >= 0)
        AND (sodium_mg IS NULL OR sodium_mg >= 0)
      );
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
    WHERE conname = 'restaurant_drink_menu_items_nutrition_nonnegative_check'
      AND conrelid = 'public.restaurant_drink_menu_items'::regclass
  ) THEN
    ALTER TABLE public.restaurant_drink_menu_items
      ADD CONSTRAINT restaurant_drink_menu_items_nutrition_nonnegative_check
      CHECK (
        (protein_g IS NULL OR protein_g >= 0)
        AND (fat_g IS NULL OR fat_g >= 0)
        AND (saturated_fat_g IS NULL OR saturated_fat_g >= 0)
        AND (carbs_g IS NULL OR carbs_g >= 0)
        AND (sugar_g IS NULL OR sugar_g >= 0)
        AND (fiber_g IS NULL OR fiber_g >= 0)
        AND (sodium_mg IS NULL OR sodium_mg >= 0)
      );
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
