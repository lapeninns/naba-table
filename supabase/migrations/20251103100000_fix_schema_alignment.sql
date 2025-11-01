-- Align booking table assignments and strategic config schema with application expectations.
-- Ensures merge-group support and numeric strategic configuration fields exist even if prior migrations were skipped.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_table_assignments'
      AND column_name = 'merge_group_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_table_assignments ADD COLUMN merge_group_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_table_assignments_merge_group_id_fkey'
      AND conrelid = 'public.booking_table_assignments'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.booking_table_assignments
               ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey
               FOREIGN KEY (merge_group_id)
               REFERENCES public.allocations(id)
               ON DELETE SET NULL';
  END IF;

  EXECUTE 'CREATE INDEX IF NOT EXISTS booking_table_assignments_merge_group_idx
             ON public.booking_table_assignments (merge_group_id)';
END;
$migration$;

DO $migration$
DECLARE
  v_has_weights boolean;
BEGIN
  -- Ensure numeric strategic configuration columns exist.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'strategic_configs'
      AND column_name = 'scarcity_weight'
  ) THEN
    EXECUTE 'ALTER TABLE public.strategic_configs ADD COLUMN scarcity_weight numeric(8,2)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'strategic_configs'
      AND column_name = 'demand_multiplier_override'
  ) THEN
    EXECUTE 'ALTER TABLE public.strategic_configs ADD COLUMN demand_multiplier_override numeric(8,3)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'strategic_configs'
      AND column_name = 'future_conflict_penalty'
  ) THEN
    EXECUTE 'ALTER TABLE public.strategic_configs ADD COLUMN future_conflict_penalty numeric(10,2)';
  END IF;

  -- Backfill values from legacy weights JSON when present before dropping it.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'strategic_configs'
      AND column_name = 'weights'
  ) INTO v_has_weights;

  IF v_has_weights THEN
    EXECUTE $backfill$
      UPDATE public.strategic_configs
      SET
        scarcity_weight = COALESCE(
          CASE
            WHEN weights ? 'scarcity_weight'
              AND jsonb_typeof(weights->'scarcity_weight') IN ('number', 'string')
            THEN NULLIF(weights->>'scarcity_weight', '')::numeric
            ELSE NULL
          END,
          scarcity_weight
        ),
        demand_multiplier_override = COALESCE(
          CASE
            WHEN weights ? 'demand_multiplier_override'
              AND jsonb_typeof(weights->'demand_multiplier_override') IN ('number', 'string')
            THEN NULLIF(weights->>'demand_multiplier_override', '')::numeric
            ELSE NULL
          END,
          demand_multiplier_override
        ),
        future_conflict_penalty = COALESCE(
          CASE
            WHEN weights ? 'future_conflict_penalty'
              AND jsonb_typeof(weights->'future_conflict_penalty') IN ('number', 'string')
            THEN NULLIF(weights->>'future_conflict_penalty', '')::numeric
            ELSE NULL
          END,
          future_conflict_penalty
        )
      WHERE weights IS NOT NULL;
    $backfill$;

    EXECUTE 'ALTER TABLE public.strategic_configs DROP COLUMN weights';
  END IF;

  -- Apply defaults and nullability constraints.
  EXECUTE 'UPDATE public.strategic_configs
             SET scarcity_weight = 22
           WHERE scarcity_weight IS NULL';
  EXECUTE 'ALTER TABLE public.strategic_configs
             ALTER COLUMN scarcity_weight SET DEFAULT 22,
             ALTER COLUMN scarcity_weight SET NOT NULL';

  EXECUTE 'ALTER TABLE public.strategic_configs
             ALTER COLUMN demand_multiplier_override DROP DEFAULT';
  EXECUTE 'ALTER TABLE public.strategic_configs
             ALTER COLUMN future_conflict_penalty DROP DEFAULT';

  EXECUTE 'ALTER TABLE public.strategic_configs
             ALTER COLUMN updated_at SET DEFAULT timezone(''utc'', now())';
END;
$migration$;
