-- Allow allocations.resource_type to track hold mirrors.
-- +goose Up
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allocations_resource_type_check'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.allocations DROP CONSTRAINT allocations_resource_type_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allocations_resource_type_check'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    EXECUTE $add_check$
      ALTER TABLE public.allocations
        ADD CONSTRAINT allocations_resource_type_check
          CHECK (resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text]))
    $add_check$;
  END IF;
END;
$migration$;
-- +goose Down
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allocations_resource_type_check'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.allocations DROP CONSTRAINT allocations_resource_type_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'allocations_resource_type_check'
      AND conrelid = 'public.allocations'::regclass
  ) THEN
    EXECUTE $restore_check$
      ALTER TABLE public.allocations
        ADD CONSTRAINT allocations_resource_type_check
          CHECK (resource_type = ANY (ARRAY['table'::text, 'merge_group'::text]))
    $restore_check$;
  END IF;
END;
$migration$;
