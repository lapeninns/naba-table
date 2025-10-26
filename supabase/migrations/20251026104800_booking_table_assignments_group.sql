-- Reintroduce merge_group_id on booking_table_assignments linking to allocations.
-- +goose Up
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND column_name = 'merge_group_id'
  ) THEN
    EXECUTE $add_column$
      ALTER TABLE public.booking_table_assignments
        ADD COLUMN merge_group_id uuid
    $add_column$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND constraint_name = 'booking_table_assignments_merge_group_id_fkey'
  ) THEN
    EXECUTE $add_fk$
      ALTER TABLE public.booking_table_assignments
        ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey
          FOREIGN KEY (merge_group_id)
          REFERENCES public.allocations(id)
          ON DELETE SET NULL
    $add_fk$;
  END IF;

  CREATE INDEX IF NOT EXISTS booking_table_assignments_merge_group_idx
    ON public.booking_table_assignments (merge_group_id);
END;
$migration$;

-- +goose Down
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'booking_table_assignments'
      AND indexname = 'booking_table_assignments_merge_group_idx'
  ) THEN
    EXECUTE 'DROP INDEX public.booking_table_assignments_merge_group_idx';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND constraint_name = 'booking_table_assignments_merge_group_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_table_assignments DROP CONSTRAINT booking_table_assignments_merge_group_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND column_name = 'merge_group_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_table_assignments DROP COLUMN merge_group_id';
  END IF;
END;
$migration$;
