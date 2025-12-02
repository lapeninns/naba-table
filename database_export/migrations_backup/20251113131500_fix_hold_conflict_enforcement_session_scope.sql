-- Fix set_hold_conflict_enforcement to use session scope instead of transaction scope
-- This ensures the setting persists across multiple queries in the same connection

CREATE OR REPLACE FUNCTION public.set_hold_conflict_enforcement(enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Changed from 'true' (transaction-scoped) to 'false' (session-scoped)
  -- so the setting persists for the entire database connection
  PERFORM set_config(
    'app.holds.strict_conflicts.enabled',
    CASE WHEN enabled THEN 'on' ELSE 'off' END,
    false  -- SESSION-scoped (not transaction-scoped)
  );
  RETURN enabled;
END;
$$;
