-- Harden service-only SECURITY DEFINER RPC privileges.
--
-- Containment:
-- - These functions are invoked through server-side service-role paths after
--   route-level auth, tenant checks, or public booking validation.
-- - Do not grant direct execution to anon or authenticated clients.
--
-- Rollback:
-- - If a deployed legacy client unexpectedly calls one of these RPCs directly,
--   restore the minimum required grant for that exact function after reviewing
--   the caller and adding an application-layer replacement.

REVOKE ALL ON FUNCTION public.create_booking_with_capacity_check(
  uuid,
  uuid,
  date,
  time without time zone,
  time without time zone,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  uuid,
  text,
  jsonb,
  integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_with_capacity_check(
  uuid,
  uuid,
  date,
  time without time zone,
  time without time zone,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  uuid,
  text,
  jsonb,
  integer
) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_with_capacity_check(
  uuid,
  uuid,
  date,
  time without time zone,
  time without time zone,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  uuid,
  text,
  jsonb,
  integer
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_capacity_check(
  uuid,
  uuid,
  date,
  time without time zone,
  time without time zone,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  uuid,
  text,
  jsonb,
  integer
) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.import_restaurant_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.import_restaurant_drink_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_restaurant_drink_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.import_restaurant_drink_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.import_restaurant_drink_menu_bundle(uuid, jsonb, jsonb, jsonb, boolean) TO service_role;
