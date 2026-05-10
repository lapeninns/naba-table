-- Migration: add_sms_delivery_log_query_indexes
-- Purpose: Add query-shaped indexes for SMS delivery feed, webhook linkage,
-- duplicate confirmation checks, and stale in-flight reconciliation.

CREATE INDEX IF NOT EXISTS sms_delivery_log_recent_confirmation_idx
  ON public.sms_delivery_log (
    booking_id,
    sms_type,
    recipient_phone,
    occurred_at DESC
  )
  WHERE status IN ('queued', 'sent', 'delivered');

CREATE INDEX IF NOT EXISTS sms_delivery_log_restaurant_occurred_id_idx
  ON public.sms_delivery_log (
    restaurant_id,
    occurred_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS sms_delivery_log_message_phone_occurred_idx
  ON public.sms_delivery_log (
    message_sid,
    recipient_phone,
    occurred_at DESC
  );

CREATE INDEX IF NOT EXISTS sms_delivery_log_inflight_reconcile_idx
  ON public.sms_delivery_log (
    occurred_at ASC,
    message_sid,
    recipient_phone
  )
  WHERE status IN ('queued', 'sent');
