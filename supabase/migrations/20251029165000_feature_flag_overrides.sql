-- Create feature_flag_overrides table to support remote toggles.
-- +goose Up
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'feature_flag_overrides'
  ) THEN
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

    EXECUTE $unique_constraint$
      ALTER TABLE public.feature_flag_overrides
        ADD CONSTRAINT feature_flag_overrides_unique_flag_env UNIQUE (flag, environment)
    $unique_constraint$;
  END IF;

  -- Allow the service role to manage overrides.
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_overrides TO service_role;

  -- Read-only access for authenticated/anon clients if required for diagnostics.
  GRANT SELECT ON public.feature_flag_overrides TO authenticated;
  GRANT SELECT ON public.feature_flag_overrides TO anon;
END;
$migration$;

-- +goose Down
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'feature_flag_overrides'
  ) THEN
    EXECUTE 'DROP TABLE public.feature_flag_overrides CASCADE';
  END IF;
END;
$migration$;
