-- Guest-auth §12.21 (defence in depth): bookings.auth_user_id binds a booking to the
-- signed-in guest who owns it. When the booking's contact email changes, that binding no
-- longer describes the owner and must be cleared in the same write.
--
-- server/bookings/owner-binding.ts clears it on direct bookings.update(...) payloads, but
-- it cannot on the RPC path: update_booking_with_capacity_check writes
-- auth_user_id = COALESCE(p_auth_user_id, existing.auth_user_id), so a null keeps the old
-- binding. This BEFORE UPDATE trigger enforces the rule for every writer:
--   * customer_email changes (trim + lower-case, as the app compares it), and
--   * the update leaves auth_user_id as it was (did not set it explicitly)
--   => NEW.auth_user_id := NULL.
-- An update that sets auth_user_id to a different value (including null) keeps that value.
-- A trigger cannot see the SET list, so an update that re-sets the SAME auth_user_id while
-- changing the email is treated as "not set" and still cleared.
--
-- Rollout: staging first, then production (pnpm db:plan-remote). Backward-safe: no data or
-- column changes, existing rows are untouched.
-- Rollback:
--   DROP TRIGGER IF EXISTS revoke_owner_binding_on_email_change ON public.bookings;
--   DROP FUNCTION IF EXISTS public.revoke_booking_owner_binding_on_email_change();
BEGIN;

CREATE OR REPLACE FUNCTION public.revoke_booking_owner_binding_on_email_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(btrim(COALESCE(NEW.customer_email, ''))) IS DISTINCT FROM lower(btrim(COALESCE(OLD.customer_email, '')))
     AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id THEN
    NEW.auth_user_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_booking_owner_binding_on_email_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS revoke_owner_binding_on_email_change ON public.bookings;
CREATE TRIGGER revoke_owner_binding_on_email_change
  BEFORE UPDATE OF customer_email ON public.bookings
  FOR EACH ROW
  WHEN (OLD.auth_user_id IS NOT NULL)
  EXECUTE FUNCTION public.revoke_booking_owner_binding_on_email_change();

COMMIT;
