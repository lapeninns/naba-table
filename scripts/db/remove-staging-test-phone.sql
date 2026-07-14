BEGIN;

DO $cleanup$
DECLARE
  target_phone text := '__TEST_PHONE_E164__';
  booking_count integer;
  customer_count integer;
  matching_count integer;
  remaining_count integer := 0;
  replacement_phones text[];
  booking_replacements text[];
  customer_replacements text[];
  phone_column record;
BEGIN
  SELECT count(*)::integer
  INTO booking_count
  FROM public.bookings
  WHERE customer_phone = target_phone;

  SELECT count(*)::integer
  INTO customer_count
  FROM public.customers
  WHERE phone = target_phone OR phone_normalized = target_phone;

  IF booking_count > 50 OR customer_count > 50 THEN
    RAISE EXCEPTION 'Legacy test-phone cleanup exceeds reserved replacement capacity';
  END IF;

  SELECT coalesce(array_agg('+447700900' || lpad((899 + ordinal)::text, 3, '0')), ARRAY[]::text[])
  INTO booking_replacements
  FROM generate_series(1, booking_count) AS ordinal;

  SELECT coalesce(array_agg('+447700900' || lpad((949 + ordinal)::text, 3, '0')), ARRAY[]::text[])
  INTO customer_replacements
  FROM generate_series(1, customer_count) AS ordinal;

  replacement_phones := booking_replacements || customer_replacements;

  IF cardinality(replacement_phones) > 0 THEN
    FOR phone_column IN
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name ILIKE '%phone%'
        AND data_type IN ('text', 'character varying', 'character')
    LOOP
      EXECUTE format(
        'SELECT count(*) FROM %I.%I WHERE %I::text = ANY ($1)',
        phone_column.table_schema,
        phone_column.table_name,
        phone_column.column_name
      )
      INTO matching_count
      USING replacement_phones;

      IF matching_count > 0 THEN
        RAISE EXCEPTION 'Reserved synthetic phone collision in %.%',
          phone_column.table_name,
          phone_column.column_name;
      END IF;
    END LOOP;
  END IF;

  WITH target_rows AS (
    SELECT id, row_number() OVER (ORDER BY id) AS ordinal
    FROM public.bookings
    WHERE customer_phone = target_phone
  )
  UPDATE public.bookings AS booking
  SET customer_phone = booking_replacements[target_rows.ordinal::integer]
  FROM target_rows
  WHERE booking.id = target_rows.id;

  UPDATE public.bookings
  SET whatsapp_opt_in = false,
      whatsapp_opt_in_at = NULL,
      whatsapp_consent_phone = NULL,
      whatsapp_consent_source = NULL,
      whatsapp_consent_version = NULL,
      whatsapp_consent_actor_id = NULL
  WHERE whatsapp_consent_phone = target_phone;

  WITH target_rows AS (
    SELECT id, row_number() OVER (ORDER BY id) AS ordinal
    FROM public.customers
    WHERE phone = target_phone OR phone_normalized = target_phone
  )
  UPDATE public.customers AS customer
  SET phone = customer_replacements[target_rows.ordinal::integer]
  FROM target_rows
  WHERE customer.id = target_rows.id;

  UPDATE public.profiles
  SET phone = NULL
  WHERE phone = target_phone;

  DELETE FROM public.restaurant_phone_numbers
  WHERE phone_number = target_phone;

  UPDATE public.restaurants
  SET contact_phone = NULL
  WHERE contact_phone = target_phone;

  UPDATE public.restaurants
  SET manager_notification_phone = NULL,
      manager_daily_summary_enabled = false,
      manager_whatsapp_enabled = false,
      manager_whatsapp_opt_in_at = NULL,
      manager_whatsapp_consent_phone = NULL,
      manager_whatsapp_consent_version = NULL,
      manager_whatsapp_consent_actor_id = NULL
  WHERE manager_notification_phone = target_phone
     OR manager_whatsapp_consent_phone = target_phone;

  FOR phone_column IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name ILIKE '%phone%'
      AND data_type IN ('text', 'character varying', 'character')
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I::text = $1',
      phone_column.table_schema,
      phone_column.table_name,
      phone_column.column_name
    )
    INTO matching_count
    USING target_phone;

    remaining_count := remaining_count + matching_count;
  END LOOP;

  IF remaining_count > 0 THEN
    RAISE EXCEPTION 'Legacy test phone remains in % public phone fields', remaining_count;
  END IF;

  RAISE NOTICE 'Legacy test-phone cleanup complete: bookings=%, customers=%, remaining=%',
    booking_count,
    customer_count,
    remaining_count;
END;
$cleanup$;

COMMIT;
