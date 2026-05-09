BEGIN;

DO $$
DECLARE
  v_table text;
  v_count bigint;
  v_target_tables text[] := ARRAY[
    'restaurant_drink_menu_modifier_options',
    'restaurant_drink_menu_modifier_groups',
    'restaurant_drink_menu_items',
    'restaurant_menu_modifier_options',
    'restaurant_menu_modifier_groups'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_target_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('select count(*) from public.%I', v_table) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION
          'Refusing to retire %. Archive and prove canonical parity first; row_count=%',
          v_table,
          v_count;
      END IF;
    END IF;
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.import_restaurant_drink_menu_bundle(
  uuid,
  jsonb,
  jsonb,
  jsonb,
  boolean
);

DROP FUNCTION IF EXISTS public.upsert_restaurant_drink_menu_item_with_modifiers(uuid, jsonb);
DROP FUNCTION IF EXISTS public.upsert_restaurant_menu_item_with_modifiers(uuid, jsonb);

DROP TABLE IF EXISTS public.restaurant_drink_menu_modifier_options;
DROP TABLE IF EXISTS public.restaurant_drink_menu_modifier_groups;
DROP TABLE IF EXISTS public.restaurant_drink_menu_items;
DROP TABLE IF EXISTS public.restaurant_menu_modifier_options;
DROP TABLE IF EXISTS public.restaurant_menu_modifier_groups;

COMMIT;
