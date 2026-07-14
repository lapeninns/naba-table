-- Staging-only preservation step for the historical menu-retirement migration.
-- The governed safe runner replays the canonical backfill before this transaction.

BEGIN;

CREATE SCHEMA IF NOT EXISTS archive;
REVOKE ALL ON SCHEMA archive FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA archive TO service_role;

CREATE TABLE IF NOT EXISTS archive.restaurant_menu_legacy_rows (
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  archived_payload jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (source_table, source_id)
);

ALTER TABLE archive.restaurant_menu_legacy_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE archive.restaurant_menu_legacy_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE archive.restaurant_menu_legacy_rows
  TO service_role;

LOCK TABLE
  public.restaurant_drink_menu_items,
  public.restaurant_drink_menu_modifier_groups,
  public.restaurant_drink_menu_modifier_options,
  public.restaurant_menu_modifier_groups,
  public.restaurant_menu_modifier_options
IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO archive.restaurant_menu_legacy_rows (
  source_table,
  source_id,
  restaurant_id,
  archived_payload
)
SELECT
  'restaurant_drink_menu_items',
  source_row.id,
  source_row.restaurant_id,
  to_jsonb(source_row)
FROM public.restaurant_drink_menu_items AS source_row
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  archived_payload = EXCLUDED.archived_payload,
  archived_at = statement_timestamp();

INSERT INTO archive.restaurant_menu_legacy_rows (
  source_table,
  source_id,
  restaurant_id,
  archived_payload
)
SELECT
  'restaurant_drink_menu_modifier_groups',
  source_row.id,
  source_row.restaurant_id,
  to_jsonb(source_row)
FROM public.restaurant_drink_menu_modifier_groups AS source_row
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  archived_payload = EXCLUDED.archived_payload,
  archived_at = statement_timestamp();

INSERT INTO archive.restaurant_menu_legacy_rows (
  source_table,
  source_id,
  restaurant_id,
  archived_payload
)
SELECT
  'restaurant_drink_menu_modifier_options',
  source_row.id,
  source_row.restaurant_id,
  to_jsonb(source_row)
FROM public.restaurant_drink_menu_modifier_options AS source_row
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  archived_payload = EXCLUDED.archived_payload,
  archived_at = statement_timestamp();

INSERT INTO archive.restaurant_menu_legacy_rows (
  source_table,
  source_id,
  restaurant_id,
  archived_payload
)
SELECT
  'restaurant_menu_modifier_groups',
  source_row.id,
  source_row.restaurant_id,
  to_jsonb(source_row)
FROM public.restaurant_menu_modifier_groups AS source_row
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  archived_payload = EXCLUDED.archived_payload,
  archived_at = statement_timestamp();

INSERT INTO archive.restaurant_menu_legacy_rows (
  source_table,
  source_id,
  restaurant_id,
  archived_payload
)
SELECT
  'restaurant_menu_modifier_options',
  source_row.id,
  source_row.restaurant_id,
  to_jsonb(source_row)
FROM public.restaurant_menu_modifier_options AS source_row
ON CONFLICT (source_table, source_id) DO UPDATE
SET
  restaurant_id = EXCLUDED.restaurant_id,
  archived_payload = EXCLUDED.archived_payload,
  archived_at = statement_timestamp();

DO $$
DECLARE
  source_table_name text;
  legacy_count bigint;
  exact_archive_count bigint;
BEGIN
  FOREACH source_table_name IN ARRAY ARRAY[
    'restaurant_drink_menu_items',
    'restaurant_drink_menu_modifier_groups',
    'restaurant_drink_menu_modifier_options',
    'restaurant_menu_modifier_groups',
    'restaurant_menu_modifier_options'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', source_table_name)
      INTO legacy_count;
    EXECUTE format(
      'SELECT count(*) FROM public.%1$I AS source_row
       JOIN archive.restaurant_menu_legacy_rows AS archived
         ON archived.source_table = %2$L
        AND archived.source_id = source_row.id
        AND archived.restaurant_id = source_row.restaurant_id
        AND archived.archived_payload = to_jsonb(source_row)',
      source_table_name,
      source_table_name
    ) INTO exact_archive_count;

    IF exact_archive_count <> legacy_count THEN
      RAISE EXCEPTION
        'Archive parity failed for %: legacy_count=%, exact_archive_count=%',
        source_table_name,
        legacy_count,
        exact_archive_count;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  legacy_drink_count bigint;
  canonical_item_count bigint;
  canonical_extension_count bigint;
BEGIN
  SELECT count(*)
  INTO legacy_drink_count
  FROM public.restaurant_drink_menu_items;

  SELECT count(*)
  INTO canonical_item_count
  FROM public.restaurant_drink_menu_items AS legacy
  JOIN public.restaurant_menu_items AS canonical
    ON canonical.restaurant_id = legacy.restaurant_id
   AND canonical.external_item_id = 'drink:' || legacy.external_drink_id
   AND canonical.item_kind = 'drink';

  IF canonical_item_count <> legacy_drink_count THEN
    RAISE EXCEPTION
      'Canonical drink item parity failed: legacy_count=%, canonical_count=%',
      legacy_drink_count,
      canonical_item_count;
  END IF;

  SELECT count(*)
  INTO canonical_extension_count
  FROM public.restaurant_drink_menu_items AS legacy
  JOIN public.restaurant_menu_items AS canonical
    ON canonical.restaurant_id = legacy.restaurant_id
   AND canonical.external_item_id = 'drink:' || legacy.external_drink_id
   AND canonical.item_kind = 'drink'
  JOIN public.restaurant_menu_item_extensions AS extension
    ON extension.restaurant_id = canonical.restaurant_id
   AND extension.menu_item_id = canonical.id;

  IF canonical_extension_count <> legacy_drink_count THEN
    RAISE EXCEPTION
      'Canonical drink extension parity failed: legacy_count=%, extension_count=%',
      legacy_drink_count,
      canonical_extension_count;
  END IF;
END
$$;

DELETE FROM public.restaurant_drink_menu_modifier_options;
DELETE FROM public.restaurant_drink_menu_modifier_groups;
DELETE FROM public.restaurant_drink_menu_items;
DELETE FROM public.restaurant_menu_modifier_options;
DELETE FROM public.restaurant_menu_modifier_groups;

DO $$
DECLARE
  remaining_count bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM public.restaurant_drink_menu_modifier_options) +
    (SELECT count(*) FROM public.restaurant_drink_menu_modifier_groups) +
    (SELECT count(*) FROM public.restaurant_drink_menu_items) +
    (SELECT count(*) FROM public.restaurant_menu_modifier_options) +
    (SELECT count(*) FROM public.restaurant_menu_modifier_groups)
  INTO remaining_count;

  IF remaining_count <> 0 THEN
    RAISE EXCEPTION
      'Legacy retirement preparation failed: remaining_count=%',
      remaining_count;
  END IF;
END
$$;

COMMIT;
