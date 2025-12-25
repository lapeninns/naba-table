-- ============================================================================
-- REVERT SCRIPT - Drop duplicate confirm_hold_assignment_tx function
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the "Could not choose the best 
-- candidate function" error
-- ============================================================================

-- Drop the function with text parameter (the one we accidentally created)
DROP FUNCTION IF EXISTS public.confirm_hold_assignment_tx(
  uuid,  -- p_hold_id
  uuid,  -- p_booking_id
  text,  -- p_idempotency_key
  boolean,  -- p_require_adjacency
  uuid,  -- p_assigned_by
  timestamptz,  -- p_window_start
  timestamptz,  -- p_window_end
  text,  -- p_expected_policy_version
  text,  -- p_expected_adjacency_hash
  text,  -- p_target_status (TEXT version - this is the duplicate)
  text,  -- p_history_reason
  jsonb,  -- p_history_metadata
  uuid   -- p_history_changed_by
);

-- Verify only one function remains
-- Run this to check:
-- SELECT proname, proargtypes::regtype[] FROM pg_proc WHERE proname = 'confirm_hold_assignment_tx';

-- The GUC functions we created should be fine to keep - they just return true
-- and don't conflict with anything. But if you want to revert those too:

-- DROP FUNCTION IF EXISTS public.set_hold_conflict_enforcement(boolean);
-- DROP FUNCTION IF EXISTS public.is_holds_strict_conflicts_enabled();
