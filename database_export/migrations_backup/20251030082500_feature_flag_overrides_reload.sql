-- Ensure feature_flag_overrides is available to PostgREST and refresh cache.
-- +goose Up
DO $migration$
DECLARE
  table_exists boolean;
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'feature_flag_overrides'
  )
  INTO table_exists;

  IF NOT table_exists THEN
    EXECUTE $create_table$
      CREATE TABLE public.feature_flag_overrides (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        flag text NOT NULL,
        environment text NOT NULL,
        value boolean NOT NULL,
        notes jsonb,
        updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
        updated_by uuid
      )
    $create_table$;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'feature_flag_overrides'
      AND constraint_name = 'feature_flag_overrides_unique_flag_env'
  )
  INTO constraint_exists;

  IF NOT constraint_exists THEN
    EXECUTE $add_constraint$
      ALTER TABLE public.feature_flag_overrides
        ADD CONSTRAINT feature_flag_overrides_unique_flag_env UNIQUE (flag, environment)
    $add_constraint$;
  END IF;

  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_overrides TO service_role';
  EXECUTE 'GRANT SELECT ON public.feature_flag_overrides TO authenticated';
  EXECUTE 'GRANT SELECT ON public.feature_flag_overrides TO anon';

  PERFORM pg_notify('pgrst', 'reload schema');
END;
$migration$;
-- +goose Down
SELECT pg_notify('pgrst', 'reload schema');
