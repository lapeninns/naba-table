-- Authentication & Team Invites rollout
-- - Renames restaurant membership roles
-- - Adds restaurant_invites table with supporting RLS

BEGIN;

-- 1. Update role vocabulary for restaurant memberships
ALTER TABLE public.restaurant_memberships
  DROP CONSTRAINT IF EXISTS restaurant_memberships_role_check;

ALTER TABLE public.restaurant_memberships
  ADD CONSTRAINT restaurant_memberships_role_check
  CHECK (
    role = ANY (
      ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text]
    )
  );

UPDATE public.restaurant_memberships
SET role = 'manager'
WHERE role = 'admin';

UPDATE public.restaurant_memberships
SET role = 'host'
WHERE role = 'staff';

UPDATE public.restaurant_memberships
SET role = 'server'
WHERE role = 'viewer';

-- 2. Refresh policies that previously referenced the legacy role names
ALTER POLICY "Admins and owners can delete bookings" ON public.bookings
USING (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
);

ALTER POLICY "Admins and owners can delete customers" ON public.customers
USING (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
);

ALTER POLICY "Owners and admins can manage memberships" ON public.restaurant_memberships
USING (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
);

ALTER POLICY "owners_admins_can_update" ON public.restaurants
USING (
  id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
);

ALTER POLICY "owners_can_delete" ON public.restaurants
USING (
  id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = 'owner'::text
  )
);

-- 3. Restaurant invites schema
CREATE TABLE IF NOT EXISTS public.restaurant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  role text NOT NULL CHECK (
    role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text])
  ),
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])
  ),
  expires_at timestamptz NOT NULL,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_invites_token_hash_key
  ON public.restaurant_invites(token_hash);

CREATE INDEX IF NOT EXISTS restaurant_invites_restaurant_status_idx
  ON public.restaurant_invites(restaurant_id, status, expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_invites_pending_unique_email
  ON public.restaurant_invites(restaurant_id, email_normalized)
  WHERE status = 'pending';

CREATE TRIGGER set_restaurant_invites_updated_at
  BEFORE UPDATE ON public.restaurant_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.restaurant_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and managers manage invites" ON public.restaurant_invites
USING (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT rm.restaurant_id
    FROM public.restaurant_memberships rm
    WHERE rm.user_id = auth.uid()
      AND rm.role = ANY (ARRAY['owner'::text, 'manager'::text])
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_invites TO service_role;

COMMIT;
