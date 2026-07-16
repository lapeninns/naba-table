CREATE OR REPLACE FUNCTION public.finalize_mobile_sms_attempt(
  p_attempt_id uuid,
  p_provider_message_id text,
  p_status text,
  p_error_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_status NOT IN (
    'claimed', 'accepted', 'queued', 'sent', 'delivered', 'undelivered', 'failed'
  ) THEN
    RAISE EXCEPTION 'Invalid mobile SMS attempt status';
  END IF;

  UPDATE public.mobile_notification_attempts attempt
  SET provider_message_id = COALESCE(attempt.provider_message_id, p_provider_message_id),
      status = CASE
        WHEN attempt.status = p_status THEN attempt.status
        WHEN attempt.status = 'claimed' THEN p_status
        WHEN attempt.status IN ('accepted', 'queued')
          AND p_status IN ('sent', 'delivered', 'undelivered', 'failed') THEN p_status
        WHEN attempt.status = 'sent'
          AND p_status IN ('delivered', 'undelivered', 'failed') THEN p_status
        ELSE attempt.status
      END,
      error_code = CASE
        WHEN p_error_code IS NOT NULL
          AND attempt.status IN ('claimed', 'accepted', 'queued', 'sent')
          AND p_status IN ('undelivered', 'failed')
        THEN p_error_code
        ELSE attempt.error_code
      END,
      updated_at = now()
  WHERE attempt.id = p_attempt_id
    AND attempt.channel = 'sms'
    AND attempt.provider = 'twilio'
    AND (
      p_provider_message_id IS NULL
      OR attempt.provider_message_id IS NULL
      OR attempt.provider_message_id = p_provider_message_id
    )
  RETURNING attempt.status INTO v_status;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_mobile_sms_attempt(uuid, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_mobile_sms_attempt(uuid, text, text, text)
  FROM anon;
REVOKE ALL ON FUNCTION public.finalize_mobile_sms_attempt(uuid, text, text, text)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mobile_sms_attempt(uuid, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.finalize_mobile_sms_attempt(uuid, text, text, text) IS
  'Atomically binds a Twilio SID and advances an SMS mobile attempt without regressing terminal callback state.';
