-- Introduce table_holds + table_hold_members to back allocator reservations.
-- +goose Up
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
  ) THEN
    EXECUTE $create_holds$
      CREATE TABLE public.table_holds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id uuid NOT NULL,
        booking_id uuid,
        zone_id uuid NOT NULL,
        start_at timestamptz NOT NULL,
        end_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
        updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
        metadata jsonb,
        CONSTRAINT table_holds_window_check CHECK (start_at < end_at)
      )
    $create_holds$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
      AND constraint_name = 'table_holds_restaurant_id_fkey'
  ) THEN
    EXECUTE $add_restaurant_fk$
      ALTER TABLE public.table_holds
        ADD CONSTRAINT table_holds_restaurant_id_fkey
          FOREIGN KEY (restaurant_id)
          REFERENCES public.restaurants(id)
          ON DELETE CASCADE
    $add_restaurant_fk$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
      AND constraint_name = 'table_holds_booking_id_fkey'
  ) THEN
    EXECUTE $add_booking_fk$
      ALTER TABLE public.table_holds
        ADD CONSTRAINT table_holds_booking_id_fkey
          FOREIGN KEY (booking_id)
          REFERENCES public.bookings(id)
          ON DELETE SET NULL
    $add_booking_fk$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
      AND constraint_name = 'table_holds_zone_id_fkey'
  ) THEN
    EXECUTE $add_zone_fk$
      ALTER TABLE public.table_holds
        ADD CONSTRAINT table_holds_zone_id_fkey
          FOREIGN KEY (zone_id)
          REFERENCES public.zones(id)
          ON DELETE CASCADE
    $add_zone_fk$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
      AND constraint_name = 'table_holds_created_by_fkey'
  ) THEN
    EXECUTE $add_created_by_fk$
      ALTER TABLE public.table_holds
        ADD CONSTRAINT table_holds_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES auth.users(id)
          ON DELETE SET NULL
    $add_created_by_fk$;
  END IF;

  EXECUTE $comment_holds$
    COMMENT ON TABLE public.table_holds IS
      'Ephemeral table reservations to guard allocations during quoting/confirmation flows.'
  $comment_holds$;

  CREATE INDEX IF NOT EXISTS table_holds_expires_at_idx
    ON public.table_holds (expires_at);

  CREATE INDEX IF NOT EXISTS table_holds_zone_start_idx
    ON public.table_holds (zone_id, start_at);

  CREATE INDEX IF NOT EXISTS table_holds_booking_idx
    ON public.table_holds (booking_id);

  -- Members --------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'table_hold_members'
  ) THEN
    EXECUTE $create_members$
      CREATE TABLE public.table_hold_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        hold_id uuid NOT NULL,
        table_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
        UNIQUE (hold_id, table_id)
      )
    $create_members$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_hold_members'
      AND constraint_name = 'table_hold_members_hold_id_fkey'
  ) THEN
    EXECUTE $add_hold_fk$
      ALTER TABLE public.table_hold_members
        ADD CONSTRAINT table_hold_members_hold_id_fkey
          FOREIGN KEY (hold_id)
          REFERENCES public.table_holds(id)
          ON DELETE CASCADE
    $add_hold_fk$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'table_hold_members'
      AND constraint_name = 'table_hold_members_table_id_fkey'
  ) THEN
    EXECUTE $add_table_fk$
      ALTER TABLE public.table_hold_members
        ADD CONSTRAINT table_hold_members_table_id_fkey
          FOREIGN KEY (table_id)
          REFERENCES public.table_inventory(id)
          ON DELETE RESTRICT
    $add_table_fk$;
  END IF;

  CREATE INDEX IF NOT EXISTS table_hold_members_table_idx
    ON public.table_hold_members (table_id);
END;
$migration$;
-- +goose Down
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'table_hold_members'
  ) THEN
    EXECUTE 'DROP TABLE public.table_hold_members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'table_holds'
  ) THEN
    EXECUTE 'DROP TABLE public.table_holds';
  END IF;
END;
$migration$;
