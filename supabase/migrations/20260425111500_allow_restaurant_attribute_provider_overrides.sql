BEGIN;

ALTER TABLE public.restaurant_attributes
  DROP CONSTRAINT IF EXISTS restaurant_attributes_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_attributes_unique'
      AND conrelid = 'public.restaurant_attributes'::regclass
  ) THEN
    ALTER TABLE public.restaurant_attributes
      ADD CONSTRAINT restaurant_attributes_unique
      UNIQUE (restaurant_id, attribute_key, source, managed_by);
  END IF;
END
$$;

COMMENT ON CONSTRAINT restaurant_attributes_unique
ON public.restaurant_attributes
IS 'Allows provider snapshots and Nabatable-managed attribute overrides to coexist for the same restaurant attribute key.';

COMMIT;
