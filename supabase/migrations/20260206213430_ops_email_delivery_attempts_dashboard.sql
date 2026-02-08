-- Migration: ops_email_delivery_attempts_dashboard
-- Purpose: Attempt-level Ops Email Delivery feed + summary for deliverability dashboard.
--
-- Notes:
-- - Attempt identity: (message_id, lower(recipient_email)) scoped to restaurant_id.
-- - "Current status" = latest occurred_at (tie-break: id DESC).
-- - Functions are designed for service-role RPC use via the Next.js API route.

-- Feed access pattern index: scope by restaurant_id and time range, newest first.
CREATE INDEX IF NOT EXISTS email_delivery_log_restaurant_occurred_at_id_idx
  ON public.email_delivery_log (restaurant_id, occurred_at DESC, id DESC);

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
        AND (v_booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
      ORDER BY l.current_occurred_at DESC, l.current_id DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT
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

CREATE OR REPLACE FUNCTION public.ops_email_delivery_attempts_summary(
  p_restaurant_id uuid,
  p_range text,
  p_statuses text[] DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_message_id text DEFAULT NULL,
  p_booking_ref text DEFAULT NULL,
  p_template_type text DEFAULT NULL,
  p_email_type text DEFAULT NULL
)
RETURNS TABLE (
  total integer,
  sent integer,
  delivered integer,
  "deliveryDelayed" integer,
  bounced integer,
  complained integer,
  failed integer,
  "deliveredRate" double precision,
  "failureRate" double precision,
  "uniqueRecipients" integer,
  "uniqueBookings" integer,
  "p50DeliverySeconds" double precision,
  "p95DeliverySeconds" double precision,
  "topFailedTemplates" jsonb,
  "topFailedEmailTypes" jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      p_restaurant_id AS restaurant_id,
      CASE p_range
        WHEN '24h' THEN now() - interval '24 hours'
        WHEN '30d' THEN now() - interval '30 days'
        ELSE now() - interval '7 days'
      END AS since_ts,
      NULLIF(trim(p_recipient_email), '') AS recipient_email,
      NULLIF(trim(p_message_id), '') AS message_id,
      NULLIF(upper(trim(p_booking_ref)), '') AS booking_ref,
      NULLIF(trim(p_template_type), '') AS template_type,
      NULLIF(trim(p_email_type), '') AS email_type,
      CASE
        WHEN p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR array_length(p_statuses, 1) = 0
          THEN NULL
        ELSE p_statuses
      END AS statuses
  ),
  booking_filter AS (
    SELECT b.id
    FROM public.bookings b
    JOIN normalized n ON true
    WHERE n.booking_ref IS NOT NULL
      AND b.restaurant_id = n.restaurant_id
      AND b.reference = n.booking_ref
  ),
  latest AS (
    SELECT DISTINCT ON (l.message_id, lower(l.recipient_email))
      l.message_id,
      l.recipient_email,
      l.booking_id,
      l.email_type,
      l.template_type,
      l.status AS current_status,
      l.occurred_at AS current_occurred_at,
      l.id AS current_id
    FROM public.email_delivery_log l
    JOIN normalized n ON true
    WHERE l.restaurant_id = n.restaurant_id
      AND l.occurred_at >= n.since_ts
      AND (n.message_id IS NULL OR l.message_id = n.message_id)
      AND (n.recipient_email IS NULL OR lower(l.recipient_email) = lower(n.recipient_email))
      AND (n.template_type IS NULL OR l.template_type = n.template_type)
      AND (n.email_type IS NULL OR l.email_type = n.email_type)
    ORDER BY l.message_id, lower(l.recipient_email), l.occurred_at DESC, l.id DESC
  ),
  filtered AS (
    SELECT l.*
    FROM latest l
    JOIN normalized n ON true
    WHERE (n.statuses IS NULL OR l.current_status = ANY(n.statuses))
      AND (n.booking_ref IS NULL OR l.booking_id IN (SELECT id FROM booking_filter))
  ),
  duration_pairs AS (
    SELECT
      f.message_id,
      lower(f.recipient_email) AS recipient_key,
      min(e.occurred_at) FILTER (WHERE e.status = 'sent') AS sent_at,
      min(e.occurred_at) FILTER (WHERE e.status = 'delivered') AS delivered_at
    FROM filtered f
    JOIN public.email_delivery_log e
      ON e.restaurant_id = p_restaurant_id
      AND e.message_id = f.message_id
      AND lower(e.recipient_email) = lower(f.recipient_email)
    GROUP BY f.message_id, lower(f.recipient_email)
  ),
  delivered_durations AS (
    SELECT extract(epoch from (delivered_at - sent_at)) AS delivery_seconds
    FROM duration_pairs
    WHERE delivered_at IS NOT NULL
      AND sent_at IS NOT NULL
      AND delivered_at >= sent_at
  ),
  failed_templates AS (
    SELECT
      coalesce(f.template_type, 'unknown') AS template_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.template_type, 'unknown')
    ORDER BY cnt DESC, template_type ASC
    LIMIT 5
  ),
  failed_email_types AS (
    SELECT
      coalesce(f.email_type, 'unknown') AS email_type,
      count(*)::int AS cnt
    FROM filtered f
    WHERE f.current_status IN ('bounced', 'complained', 'failed')
    GROUP BY coalesce(f.email_type, 'unknown')
    ORDER BY cnt DESC, email_type ASC
    LIMIT 5
  ),
  counts AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE current_status = 'sent')::int AS sent,
      count(*) FILTER (WHERE current_status = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE current_status = 'delivery_delayed')::int AS delivery_delayed,
      count(*) FILTER (WHERE current_status = 'bounced')::int AS bounced,
      count(*) FILTER (WHERE current_status = 'complained')::int AS complained,
      count(*) FILTER (WHERE current_status = 'failed')::int AS failed,
      count(distinct lower(recipient_email))::int AS unique_recipients,
      count(distinct booking_id) FILTER (WHERE booking_id IS NOT NULL)::int AS unique_bookings
    FROM filtered
  )
  SELECT
    c.total,
    c.sent,
    c.delivered,
    c.delivery_delayed AS "deliveryDelayed",
    c.bounced,
    c.complained,
    c.failed,
    CASE WHEN c.total = 0 THEN 0 ELSE c.delivered::double precision / c.total END AS "deliveredRate",
    CASE WHEN c.total = 0 THEN 0 ELSE (c.bounced + c.complained + c.failed)::double precision / c.total END AS "failureRate",
    c.unique_recipients AS "uniqueRecipients",
    c.unique_bookings AS "uniqueBookings",
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p50DeliverySeconds",
    (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY delivery_seconds) FROM delivered_durations) AS "p95DeliverySeconds",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('templateType', template_type, 'count', cnt)
          ORDER BY cnt DESC, template_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_templates
    ) AS "topFailedTemplates",
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object('emailType', email_type, 'count', cnt)
          ORDER BY cnt DESC, email_type ASC
        ),
        '[]'::jsonb
      )
      FROM failed_email_types
    ) AS "topFailedEmailTypes"
  FROM counts c;
$$;

REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid, text, integer, integer, text[], text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_feed(
  uuid, text, integer, integer, text[], text, text, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) TO service_role;
