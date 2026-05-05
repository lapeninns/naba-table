CREATE OR REPLACE FUNCTION public.accept_restaurant_invite(
  p_invite_id uuid,
  p_user_id uuid,
  p_restaurant_id uuid,
  p_role text
)
RETURNS public.restaurant_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_invite public.restaurant_invites;
BEGIN
  UPDATE public.restaurant_invites
  SET
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE id = p_invite_id
    AND restaurant_id = p_restaurant_id
    AND role = p_role
    AND status = 'pending'
    AND expires_at > now()
  RETURNING * INTO accepted_invite;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite is not pending or has expired'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.restaurant_memberships (
    user_id,
    restaurant_id,
    role
  )
  VALUES (
    p_user_id,
    p_restaurant_id,
    p_role
  )
  ON CONFLICT (user_id, restaurant_id)
  DO UPDATE SET role = excluded.role;

  RETURN accepted_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_restaurant_invite(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_restaurant_invite(uuid, uuid, uuid, text) TO service_role;
