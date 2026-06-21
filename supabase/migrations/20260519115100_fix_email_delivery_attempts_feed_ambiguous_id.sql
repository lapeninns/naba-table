CREATE OR REPLACE FUNCTION public.ops_email_delivery_attempts_feed(
  p_restaurant_id uuid,
  p_range text,
  p_page integer,
  p_page_size integer,
  p_statuses text[] DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_booking_ref text DEFAULT NULL,
  p_template_type text DEFAULT NULL,
  p_email_type text DEFAULT NULL
)
RETURNS TABLE (
  "id" uuid,
  "messageId" text,
  "recipientEmail" text,
  "bookingId" uuid,
  "emailType" text,
  "templateType" text,
  "provider" text,
  "currentStatus" text,
  "currentOccurredAt" timestamptz,
  "events" jsonb,
  "booking" jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_since_ts timestamptz;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_limit integer;
  v_recipient_email text;
  v_message_id text;
  v_booking_ref text;
  v_template_type text;
  v_email_type text;
  v_statuses text[];
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'p_restaurant_id is required' USING ERRCODE = '22004';
  END IF;

  v_since_ts := CASE p_range
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE now() - interval '7 days'
  END;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_offset := (v_page - 1) * v_page_size;
  v_limit := v_page_size + 1;

  v_recipient_email := NULLIF(trim(p_recipient_email), '');
  v_message_id := NULLIF(trim(p_message_id), '');
  v_booking_ref := NULLIF(upper(trim(p_booking_ref)), '');
  v_template_type := NULLIF(trim(p_template_type), '');
  v_email_type := NULLIF(trim(p_email_type), '');
  v_statuses := CASE
    WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
      THEN NULL
    ELSE p_statuses
  END;

  RETURN QUERY
    WITH booking_filter AS (
      SELECT b.id
      FROM public.bookings b
      WHERE v_booking_ref IS NOT NULL
        AND b.restaurant_id = p_restaurant_id
        AND b.reference = v_booking_ref
    ),
    latest AS (
      SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
        l.message_id,
        l.recipient_email,
        l.booking_id,
        l.email_type,
        l.template_type,
        l.provider,
        l.status AS current_status,
        l.occurred_at AS current_occurred_at,
        l.id AS current_id
      FROM public.email_delivery_log l
      WHERE l.restaurant_id = p_restaurant_id
        AND l.occurred_at >= v_since_ts
        AND (v_message_id IS NULL OR l.message_id = v_message_id)
        AND (v_recipient_email IS NULL OR lower(l.recipient_email) = lower(v_recipient_email))
        AND (v_template_type IS NULL OR l.template_type = v_template_type)
        AND (v_email_type IS NULL OR l.email_type = v_email_type)
      ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
    ),
    filtered AS (
      SELECT l.*
      FROM latest l
      WHERE (v_statuses IS NULL OR l.current_status = ANY(v_statuses))
        AND (v_booking_ref IS NULL OR l.booking_id IN (SELECT bf.id FROM booking_filter bf))
      ORDER BY l.current_occurred_at DESC, l.current_id DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT
      f.current_id AS "id",
      f.message_id AS "messageId",
      f.recipient_email AS "recipientEmail",
      f.booking_id AS "bookingId",
      f.email_type AS "emailType",
      f.template_type AS "templateType",
      f.provider AS "provider",
      f.current_status AS "currentStatus",
      f.current_occurred_at AS "currentOccurredAt",
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'bookingId', e.booking_id,
              'restaurantId', e.restaurant_id,
              'emailType', e.email_type,
              'templateType', e.template_type,
              'recipientEmail', e.recipient_email,
              'messageId', e.message_id,
              'status', e.status,
              'provider', e.provider,
              'occurredAt', e.occurred_at,
              'error', e.error,
              'metadata', e.metadata
            )
            ORDER BY e.occurred_at ASC, e.id ASC
          ),
          '[]'::jsonb
        )
        FROM public.email_delivery_log e
        WHERE e.restaurant_id = p_restaurant_id
          AND e.message_id = f.message_id
          AND lower(e.recipient_email) = lower(f.recipient_email)
      ) AS "events",
      (
        SELECT CASE
          WHEN f.booking_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', b.id,
            'reference', b.reference,
            'bookingDate', b.booking_date,
            'startTime', b.start_time,
            'endTime', b.end_time,
            'customerName', b.customer_name,
            'partySize', b.party_size
          )
        END
        FROM public.bookings b
        WHERE b.id = f.booking_id
        LIMIT 1
      ) AS "booking"
    FROM filtered f;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid,
  text,
  integer,
  integer,
  text[],
  text,
  text,
  text,
  text,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid,
  text,
  integer,
  integer,
  text[],
  text,
  text,
  text,
  text,
  text
) TO service_role;
