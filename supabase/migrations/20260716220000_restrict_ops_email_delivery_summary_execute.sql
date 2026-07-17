REVOKE ALL ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_summary(
  uuid, text, text[], text, text, text, text, text
) TO service_role;
