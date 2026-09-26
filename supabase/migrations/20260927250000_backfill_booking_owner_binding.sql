-- Guest-auth backfill: link existing bookings to the signed-in guest who owns them.
--
-- THIS MIGRATION DOES NOT LINK ANYTHING. It creates the audit table and the operator-only
-- function public.backfill_booking_owner_binding_v1(). An operator runs the function by hand,
-- per project, ONLY after confirming that project requires email confirmation:
--   Supabase dashboard -> Authentication -> Providers -> Email -> "Confirm email" is enabled
--   (GoTrue mailer_autoconfirm is off).
-- With autoconfirm on, email_confirmed_at is stamped at sign-up without any email being sent,
-- so it does not prove mailbox ownership: an account registered with someone else's address
-- would be linked to that person's bookings and could view and cancel them. If the check
-- fails or is unclear, skip the backfill; guests re-link a booking by opening its emailed
-- link (claimBookingForUser).
--   Run (after the check):  SELECT public.backfill_booking_owner_binding_v1();
--
-- Purpose
--   PR #181 moved "My bookings" and guest session ownership to bookings.auth_user_id only
--   (server/bookings/my-bookings-page.ts, server/bookings/guest-booking-access.ts). New
--   bookings made by a signed-in guest with a confirmed, matching email are linked at create
--   time (server/bookings/create-owner-binding.ts). Bookings made before this release have
--   auth_user_id NULL and would disappear from their owner's "My bookings", which on main
--   matched them by contact email. The operator-run function below links them once.
--
-- Rule (the same one claimBookingForUser applies on the link-redeem and create paths)
--   A booking is linked to auth.users.id when ALL of these hold:
--     * bookings.auth_user_id IS NULL (an existing link, genuine or not, is never changed);
--     * bookings.customer_email is not empty after trimming;
--     * exactly ONE auth.users row has lower(btrim(email)) = lower(btrim(customer_email)) with
--       email_confirmed_at IS NOT NULL, is_anonymous not true and deleted_at IS NULL. Two or
--       more such users (case variants, SSO duplicates) are ambiguous and link nothing.
--
-- Why it is safe (only when "Confirm email" is enabled for the project; see above)
--   Ownership by a verified email is exactly what main's "My bookings" already granted: a
--   signed-in guest saw every booking whose contact email equalled their account email. This
--   backfill grants the same set, narrowed to confirmed, non-anonymous, unambiguous accounts,
--   so no guest gains access to a booking they could not already see. Unconfirmed accounts
--   gain nothing; they can still claim a booking from an emailed link after confirming.
--   email_confirmed_at is proof of mailbox ownership only while confirmation is required,
--   which is why the migration does not run the backfill itself.
--   Backward-safe: no column, constraint or existing-link changes; the previous app ignores
--   auth_user_id for "My bookings", so it is unaffected. Idempotent: a re-run only considers
--   rows that are still unlinked, so it is a no-op unless new eligible rows appeared.
--
-- Triggers on public.bookings
--   * revoke_owner_binding_on_email_change (20260927200100) is BEFORE UPDATE OF
--     customer_email WHEN (OLD.auth_user_id IS NOT NULL). This UPDATE sets only auth_user_id
--     on rows whose OLD.auth_user_id IS NULL, so it never fires.
--   * release_terminal_booking_table_state and enqueue_completed_review_scheduling are
--     UPDATE OF status triggers and do not fire.
--   * bookings_updated_at bumps updated_at on each linked row (nothing uses bookings.updated_at
--     as a concurrency token). If bookings is in a realtime publication, each linked row emits
--     one change event.
--
-- Size and locking
--   One set-based statement (a data-modifying CTE: UPDATE ... RETURNING feeds the audit
--   INSERT), executed once by the operator through backfill_booking_owner_binding_v1(). It
--   reads auth.users once (grouped by normalized email), scans bookings once, and takes row
--   locks only on the rows it links, plus ROW EXCLUSIVE on bookings, which does not block
--   reads or other writes to other rows. Batching is not used: the function runs in one
--   transaction and cannot COMMIT between batches inside it, so batching
--   would hold the same locks for the same time while adding loops. Bookings is a
--   per-venue reservations table (thousands to low hundreds of thousands of rows), well
--   inside a single-statement update. A concurrent guest claim on the same row wins or waits;
--   READ COMMITTED re-checks auth_user_id IS NULL on the new row version, so a row linked in
--   the meantime is skipped.
--
-- Pre-flight (operator, read-only; run on staging, then production, before running the function)
--   WITH users_by_email AS (
--     SELECT lower(btrim(u.email)) AS email_key, count(*) AS n
--     FROM auth.users u
--     WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
--       AND u.email_confirmed_at IS NOT NULL
--       AND u.is_anonymous IS NOT TRUE AND u.deleted_at IS NULL
--     GROUP BY 1
--   )
--   SELECT
--     count(*) FILTER (WHERE ube.n = 1) AS bookings_to_link,
--     count(*) FILTER (WHERE ube.n > 1) AS bookings_skipped_ambiguous,
--     count(DISTINCT b.restaurant_id) FILTER (WHERE ube.n = 1) AS restaurants_affected
--   FROM public.bookings b
--   JOIN users_by_email ube ON ube.email_key = lower(btrim(b.customer_email))
--   WHERE b.auth_user_id IS NULL AND btrim(b.customer_email) <> '';
--
-- Verification (after the operator ran the function; the audit table is empty until then)
--   -- 1. bookings_to_link above equals the audit row count:
--   SELECT count(*) FROM public.booking_owner_backfill_audit;
--   -- 2. every audited row is still linked to the audited user (0 expected right after):
--   SELECT count(*) FROM public.booking_owner_backfill_audit a
--   JOIN public.bookings b ON b.id = a.booking_id
--   WHERE b.auth_user_id IS DISTINCT FROM a.auth_user_id;
--   -- 3. every link matches a confirmed user with the same normalized email (0 expected):
--   SELECT count(*) FROM public.booking_owner_backfill_audit a
--   JOIN public.bookings b ON b.id = a.booking_id
--   JOIN auth.users u ON u.id = a.auth_user_id
--   WHERE u.email_confirmed_at IS NULL
--      OR lower(btrim(u.email)) <> lower(btrim(b.customer_email));
--   -- 4. re-running links nothing (returns 0; run inside BEGIN ... ROLLBACK if preferred):
--   SELECT public.backfill_booking_owner_binding_v1();
--
-- Rollback
--   Backfilled rows cannot be told apart from genuinely linked ones except through the audit
--   table, so the rollback un-links exactly the audited rows that still carry the audited
--   user (a row re-linked to someone else since is left alone):
--     UPDATE public.bookings b SET auth_user_id = NULL
--     FROM public.booking_owner_backfill_audit a
--     WHERE a.booking_id = b.id AND b.auth_user_id = a.auth_user_id;
--     DROP FUNCTION IF EXISTS public.backfill_booking_owner_binding_v1(uuid);
--     DROP TABLE IF EXISTS public.booking_owner_backfill_audit;
--   Guests keep access to un-linked bookings through emailed links.
--
-- Rollout: apply staging first, then production (pnpm db:plan-remote), BEFORE PR #181 is
-- merged. Then, per project and only after the "Confirm email" check above, run
-- SELECT public.backfill_booking_owner_binding_v1(); and the verification queries.
BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_owner_backfill_audit (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  backfilled_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_owner_backfill_audit IS
  'Rollback record for 20260927250000: bookings whose auth_user_id was set by the verified-email owner backfill.';

ALTER TABLE public.booking_owner_backfill_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_owner_backfill_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.booking_owner_backfill_audit FROM anon;
REVOKE ALL ON TABLE public.booking_owner_backfill_audit FROM authenticated;
GRANT SELECT ON TABLE public.booking_owner_backfill_audit TO service_role;

-- p_restaurant_id NULL links every restaurant (the operator run); a restaurant id limits the
-- run to that restaurant (used by tests/db/booking-owner-backfill.sql). Returns rows linked.
CREATE OR REPLACE FUNCTION public.backfill_booking_owner_binding_v1(p_restaurant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_linked integer;
BEGIN
  WITH users_by_email AS (
    SELECT lower(btrim(u.email)) AS email_key, (array_agg(u.id))[1] AS user_id
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND btrim(u.email) <> ''
      AND u.email_confirmed_at IS NOT NULL
      AND u.is_anonymous IS NOT TRUE
      AND u.deleted_at IS NULL
    GROUP BY lower(btrim(u.email))
    HAVING count(*) = 1
  ),
  linked AS (
    UPDATE public.bookings b
    SET auth_user_id = ube.user_id
    FROM users_by_email ube
    WHERE b.auth_user_id IS NULL
      AND btrim(b.customer_email) <> ''
      AND lower(btrim(b.customer_email)) = ube.email_key
      AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
    RETURNING b.id, b.auth_user_id
  )
  INSERT INTO public.booking_owner_backfill_audit (booking_id, auth_user_id, backfilled_at)
  SELECT linked.id, linked.auth_user_id, now()
  FROM linked
  ON CONFLICT (booking_id) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id,
        backfilled_at = EXCLUDED.backfilled_at;

  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN v_linked;
END;
$$;

COMMENT ON FUNCTION public.backfill_booking_owner_binding_v1(uuid) IS
  'Operator-only, run by hand: link unlinked bookings to the single confirmed, non-anonymous auth user with the same normalized email; records each link in booking_owner_backfill_audit. Run ONLY when the project requires email confirmation (mailer_autoconfirm off); otherwise email_confirmed_at does not prove mailbox ownership.';

REVOKE ALL ON FUNCTION public.backfill_booking_owner_binding_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- No backfill runs here. See the header: the operator runs it only after the project check.

COMMIT;
