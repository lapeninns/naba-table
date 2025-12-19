--
-- PostgreSQL database dump
--

\restrict 1jFnHMaakqLCR8tJoIPd0vUTOq0AexO1GGfjEaG7p14pU6r3aLKFX1Q53VBfpRS

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: analytics_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.analytics_event_type AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


--
-- Name: area_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.area_type AS ENUM (
    'indoor',
    'outdoor',
    'covered'
);


--
-- Name: booking_assignment_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_assignment_state AS ENUM (
    'created',
    'capacity_verified',
    'assignment_pending',
    'assignment_in_progress',
    'assigned',
    'confirmed',
    'failed',
    'manual_review'
);


--
-- Name: booking_change_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_change_type AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'PRIORITY_WAITLIST',
    'no_show',
    'pending_allocation',
    'checked_in'
);


--
-- Name: TYPE booking_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.booking_status IS 'Lifecycle status of a booking (pending, confirmed, checked_in, completed, cancelled, no_show, etc).';


--
-- Name: booking_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_type AS ENUM (
    'lunch',
    'drinks',
    'dinner',
    'christmas_party',
    'curry_and_carols'
);


--
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


--
-- Name: manual_assignment_session_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.manual_assignment_session_state AS ENUM (
    'none',
    'proposed',
    'held',
    'confirmed',
    'expired',
    'conflicted',
    'cancelled'
);


--
-- Name: seating_preference_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.seating_preference_type AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);


--
-- Name: table_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_category AS ENUM (
    'bar',
    'dining',
    'lounge',
    'patio',
    'private'
);


--
-- Name: table_hold_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_hold_status AS ENUM (
    'active',
    'expired',
    'confirmed',
    'cancelled'
);


--
-- Name: table_mobility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_mobility AS ENUM (
    'movable',
    'fixed'
);


--
-- Name: table_seating_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_seating_type AS ENUM (
    'standard',
    'sofa',
    'booth',
    'high_top'
);


--
-- Name: table_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.table_status AS ENUM (
    'available',
    'reserved',
    'occupied',
    'out_of_service'
);


--
-- Name: TYPE table_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.table_status IS 'Status of a restaurant table: available, reserved (booked), occupied (guests seated), out_of_service (maintenance)';


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: allocations_overlap(tstzrange, tstzrange); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(a && b, false);
$$;


--
-- Name: FUNCTION allocations_overlap(a tstzrange, b tstzrange); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.allocations_overlap(a tstzrange, b tstzrange) IS 'Returns true when two timestamptz ranges overlap (half-open [start,end) semantics).';


--
-- Name: allowed_capacities_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.allowed_capacities_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;


--
-- Name: apply_booking_state_transition(uuid, public.booking_status, timestamp with time zone, timestamp with time zone, timestamp with time zone, public.booking_status, public.booking_status, uuid, timestamp with time zone, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_booking_state_transition(p_booking_id uuid, p_status public.booking_status, p_checked_in_at timestamp with time zone, p_checked_out_at timestamp with time zone, p_updated_at timestamp with time zone, p_history_from public.booking_status, p_history_to public.booking_status, p_history_changed_by uuid, p_history_changed_at timestamp with time zone, p_history_reason text, p_history_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(status public.booking_status, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_updated public.bookings%ROWTYPE;
    v_current public.booking_status;
    v_rows integer;
  BEGIN
    UPDATE public.bookings
    SET status = p_status,
        checked_in_at = p_checked_in_at,
        checked_out_at = p_checked_out_at,
        updated_at = p_updated_at
    WHERE id = p_booking_id
      AND public.bookings.status = p_history_from
    RETURNING * INTO v_updated;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      SELECT status INTO v_current FROM public.bookings WHERE id = p_booking_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id USING ERRCODE = 'P0002';
      END IF;
      RAISE EXCEPTION 'booking_state_conflict'
        USING ERRCODE = 'P0004',
              DETAIL = format('Current status %s does not match expected %s', v_current, p_history_from);
    END IF;

    INSERT INTO public.booking_state_history (
      booking_id, from_status, to_status, changed_by, changed_at, reason, metadata
    ) VALUES (
      p_booking_id, p_history_from, p_history_to, p_history_changed_by, p_history_changed_at, p_history_reason, COALESCE(p_history_metadata, '{}'::jsonb)
    );

    RETURN QUERY SELECT v_updated.status, v_updated.checked_in_at, v_updated.checked_out_at, v_updated.updated_at;
  END;
$$;


--
-- Name: are_tables_connected(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.are_tables_connected(table_ids uuid[]) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  unique_tables uuid[];
  start_table uuid;
  total_count integer;
  connected_count integer;
BEGIN
  SELECT array_agg(DISTINCT id)
  INTO unique_tables
  FROM unnest(table_ids) AS id
  WHERE id IS NOT NULL;

  total_count := array_length(unique_tables, 1);

  IF total_count IS NULL OR total_count = 0 THEN
    RETURN false;
  END IF;

  IF total_count = 1 THEN
    RETURN true;
  END IF;

  start_table := unique_tables[1];

  WITH RECURSIVE connected AS (
    SELECT start_table AS table_id
    UNION
    SELECT adj.table_b
    FROM connected
    JOIN public.table_adjacencies adj
      ON adj.table_a = connected.table_id
    WHERE adj.table_b = ANY(unique_tables)
  )
  SELECT COUNT(DISTINCT table_id)
  INTO connected_count
  FROM connected;

  RETURN connected_count = total_count;
END;
$$;


--
-- Name: assign_merged_tables(uuid, uuid[], boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean DEFAULT true, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_count integer;
BEGIN
  v_table_count := COALESCE(array_length(p_table_ids, 1), 0);

  IF v_table_count < 2 THEN
    RAISE EXCEPTION 'assign_merged_tables requires at least two table ids.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := p_table_ids,
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := p_require_adjacency,
    p_assigned_by := p_assigned_by
  );
END;
$$;


--
-- Name: FUNCTION assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_merged_tables(p_booking_id uuid, p_table_ids uuid[], p_require_adjacency boolean, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns multiple tables to a booking with optional adjacency enforcement.';


--
-- Name: assign_single_table(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_table_id IS NULL THEN
    RAISE EXCEPTION 'assign_single_table requires a table id.';
  END IF;

  PERFORM public.assign_tables_atomic_v2(
    p_booking_id := p_booking_id,
    p_table_ids := ARRAY[p_table_id],
    p_idempotency_key := p_idempotency_key,
    p_require_adjacency := false,
    p_assigned_by := p_assigned_by
  );
END;
$$;


--
-- Name: FUNCTION assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_single_table(p_booking_id uuid, p_table_id uuid, p_assigned_by uuid, p_idempotency_key text) IS 'Atomically assigns a single table to a booking; preferred entrypoint for standard seating.';


--
-- Name: assign_tables_atomic(uuid, uuid[], tstzrange, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text) RETURNS TABLE(table_id uuid, assignment_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_booking RECORD;
      v_restaurant_id uuid;
      v_target_tables uuid[];
      v_target_table uuid;
      v_existing_tables uuid[];
      v_table RECORD;
      v_slot_id uuid := NULL;
      v_now timestamptz := now();
      v_window tstzrange := p_window;
      v_assignment_id uuid;
      v_lock_restaurant int4;
      v_lock_date int4;
    BEGIN
      IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one table id'
          USING ERRCODE = '23514';
      END IF;

      SELECT array_agg(DISTINCT table_id ORDER BY table_id)
      INTO v_target_tables
      FROM unnest(p_table_ids) AS t(table_id);

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RAISE EXCEPTION 'assign_tables_atomic requires at least one valid table id'
          USING ERRCODE = '23514';
      END IF;

      IF array_length(v_target_tables, 1) > 1 THEN
        RAISE EXCEPTION 'assign_tables_atomic only supports a single table after merge removal'
          USING ERRCODE = '23514';
      END IF;

      v_target_table := v_target_tables[1];

      SELECT *
      INTO v_booking
      FROM public.bookings
      WHERE id = p_booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found', p_booking_id
          USING ERRCODE = 'P0002';
      END IF;

      v_restaurant_id := v_booking.restaurant_id;

      v_lock_restaurant := hashtext(v_restaurant_id::text);
      v_lock_date := COALESCE((v_booking.booking_date - DATE '2000-01-01')::int, 0);
      PERFORM pg_advisory_xact_lock(v_lock_restaurant, v_lock_date);

      IF v_window IS NULL THEN
        v_window := tstzrange(v_booking.start_at, v_booking.end_at, '[)');
      END IF;

      IF v_window IS NULL OR lower(v_window) IS NULL OR upper(v_window) IS NULL OR lower(v_window) >= upper(v_window) THEN
        RAISE EXCEPTION 'Invalid assignment window for booking %', p_booking_id
          USING ERRCODE = '22000';
      END IF;

      IF p_idempotency_key IS NOT NULL THEN
        SELECT array_agg(bta.table_id ORDER BY bta.table_id)
        INTO v_existing_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.idempotency_key = p_idempotency_key;

        IF v_existing_tables IS NOT NULL THEN
          IF v_existing_tables <> v_target_tables THEN
            RAISE EXCEPTION 'assign_tables_atomic idempotency key mismatch'
              USING ERRCODE = 'P0003',
                    DETAIL = 'Idempotency key reuse detected with a different table id';
          END IF;

          RETURN QUERY
            SELECT
              bta.table_id,
              bta.id AS assignment_id
            FROM public.booking_table_assignments bta
            WHERE bta.booking_id = p_booking_id
              AND bta.idempotency_key = p_idempotency_key;

          RETURN;
        END IF;
      END IF;

      SELECT id, restaurant_id
      INTO v_table
      FROM public.table_inventory
      WHERE id = v_target_table
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Table % not found', v_target_table
          USING ERRCODE = 'P0002';
      END IF;

      IF v_table.restaurant_id <> v_restaurant_id THEN
        RAISE EXCEPTION 'Table % belongs to a different restaurant', v_target_table
          USING ERRCODE = '23503';
      END IF;

      IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
        SELECT id
        INTO v_slot_id
        FROM public.booking_slots
        WHERE restaurant_id = v_restaurant_id
          AND slot_date = v_booking.booking_date
          AND slot_time = v_booking.start_time
        LIMIT 1;

        IF v_slot_id IS NULL THEN
          SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
          INTO v_slot_id;
        END IF;
      END IF;

      INSERT INTO public.booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        idempotency_key
      ) VALUES (
        p_booking_id,
        v_target_table,
        v_slot_id,
        p_assigned_by,
        p_idempotency_key
      )
      ON CONFLICT (booking_id, table_id) DO UPDATE
      SET assigned_by = EXCLUDED.assigned_by,
          assigned_at = v_now,
          idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key)
      RETURNING id INTO v_assignment_id;

      BEGIN
        INSERT INTO public.allocations (
          booking_id,
          restaurant_id,
          resource_type,
          resource_id,
          "window",
          created_by,
          shadow,
          created_at,
          updated_at
        ) VALUES (
          p_booking_id,
          v_restaurant_id,
          'table',
          v_target_table,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = EXCLUDED.created_by,
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_target_table, p_booking_id);
      END;

      UPDATE public.table_inventory
      SET status = 'reserved'::public.table_status
      WHERE id = v_target_table;

      table_id := v_target_table;
      assignment_id := v_assignment_id;
      RETURN NEXT;
    END;
    $$;


--
-- Name: FUNCTION assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic(p_booking_id uuid, p_table_ids uuid[], p_window tstzrange, p_assigned_by uuid, p_idempotency_key text) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- Name: assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text DEFAULT NULL::text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_booking RECORD;
    v_zone_id uuid;
    v_restaurant_id uuid;
    v_service_date date;
    v_lock_zone int4;
    v_lock_date int4;
    v_now timestamptz := timezone('utc', now());
    v_table_ids uuid[];
    v_table_count integer;
    v_table RECORD;
    v_loaded_count integer := 0;
    v_slot_id uuid := NULL;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_window tstzrange;
    v_timezone text := NULL;
    v_hold_conflict uuid;
    v_merge_allocation_id uuid := NULL;
    v_table_assignment_id uuid;
    v_existing RECORD;
    v_adjacency_count integer;
    v_table_id uuid;
    v_merge_group_supported boolean := false;
  BEGIN
    IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one table id'
        USING ERRCODE = '23514';
    END IF;

    SELECT array_agg(DISTINCT t.table_id ORDER BY t.table_id)
    INTO v_table_ids
    FROM unnest(p_table_ids) AS t(table_id);

    IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one valid table id'
        USING ERRCODE = '23514';
    END IF;

    v_table_count := array_length(v_table_ids, 1);

    SELECT
      b.*,
      r.timezone AS restaurant_timezone
    INTO v_booking
    FROM public.bookings b
    LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = p_booking_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    v_restaurant_id := v_booking.restaurant_id;
    v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'booking_table_assignments'
        AND column_name = 'merge_group_id'
    )
    INTO v_merge_group_supported;

    IF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
      v_start_at := v_booking.start_at;
      v_end_at := v_booking.end_at;
    ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL AND v_booking.end_time IS NOT NULL THEN
      v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.start_time)::int,
        EXTRACT(MINUTE FROM v_booking.start_time)::int,
        EXTRACT(SECOND FROM v_booking.start_time),
        v_timezone
      );
      v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.end_time)::int,
        EXTRACT(MINUTE FROM v_booking.end_time)::int,
        EXTRACT(SECOND FROM v_booking.end_time),
        v_timezone
      );
    ELSE
      RAISE EXCEPTION 'Booking % missing start/end window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    IF v_start_at >= v_end_at THEN
      RAISE EXCEPTION 'Booking % has invalid time window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    v_window := tstzrange(v_start_at, v_end_at, '[)');

    FOR v_table IN
      SELECT id, restaurant_id, zone_id, active, status, mobility
      FROM public.table_inventory
      WHERE id = ANY (v_table_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      IF v_table.restaurant_id <> v_restaurant_id THEN
        RAISE EXCEPTION 'Table % belongs to a different restaurant', v_table.id
          USING ERRCODE = '23503';
      END IF;

      IF v_table.zone_id IS NULL THEN
        RAISE EXCEPTION 'Table % is not assigned to a zone', v_table.id
          USING ERRCODE = '23514';
      END IF;

      IF v_table.active IS NOT TRUE THEN
        RAISE EXCEPTION 'Table % is inactive', v_table.id
          USING ERRCODE = '23514';
      END IF;

      IF v_zone_id IS NULL THEN
        v_zone_id := v_table.zone_id;
      ELSIF v_zone_id <> v_table.zone_id THEN
        RAISE EXCEPTION 'All tables must belong to the same zone (found %, expected %)', v_table.zone_id, v_zone_id
          USING ERRCODE = '23514';
      END IF;

      IF v_table_count > 1 AND v_table.mobility <> 'movable'::public.table_mobility THEN
        RAISE EXCEPTION 'Merged assignments require movable tables (% is %)', v_table.id, v_table.mobility
          USING ERRCODE = '23514';
      END IF;

      v_loaded_count := v_loaded_count + 1;
    END LOOP;

    IF v_loaded_count <> v_table_count THEN
      RAISE EXCEPTION 'Unable to load all requested tables for booking %', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF p_require_adjacency AND v_table_count > 1 THEN
      FOR v_table IN
        SELECT id FROM unnest(v_table_ids) AS t(id)
      LOOP
        SELECT COUNT(*)
        INTO v_adjacency_count
        FROM public.table_adjacencies
        WHERE table_a = v_table.id
          AND table_b = ANY (v_table_ids)
          AND table_b <> v_table.id;

        IF COALESCE(v_adjacency_count, 0) = 0 THEN
          RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table.id
            USING ERRCODE = '23514';
        END IF;
      END LOOP;
    END IF;

    v_service_date := v_booking.booking_date;
    IF v_service_date IS NULL THEN
      v_service_date := (v_start_at AT TIME ZONE v_timezone)::date;
    END IF;

    v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
    v_lock_date := COALESCE((v_service_date - DATE '2000-01-01')::int, 0);
    PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_date);

    IF p_idempotency_key IS NOT NULL THEN
      SELECT *
      INTO v_existing
      FROM public.booking_assignment_idempotency
      WHERE booking_id = p_booking_id
        AND idempotency_key = p_idempotency_key;

      IF FOUND THEN
        IF v_existing.table_ids IS NULL OR array_length(v_existing.table_ids, 1) <> v_table_count
           OR (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_existing.table_ids) AS e(elem))
              <> (SELECT array_agg(elem ORDER BY elem) FROM unnest(v_table_ids) AS e(elem)) THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
            USING ERRCODE = 'P0003',
                  DETAIL = 'Idempotency key reuse detected with a different table set';
        END IF;

        RETURN QUERY
          SELECT
            bta.table_id,
            lower(v_existing.assignment_window) AS start_at,
            upper(v_existing.assignment_window) AS end_at,
            v_existing.merge_group_allocation_id
          FROM public.booking_table_assignments bta
          WHERE bta.booking_id = p_booking_id
            AND bta.idempotency_key = p_idempotency_key
            AND bta.table_id = ANY (v_table_ids)
          ORDER BY bta.table_id;

        RETURN;
      END IF;
    END IF;

    SELECT th.id
    INTO v_hold_conflict
    FROM public.table_holds th
    JOIN public.table_hold_members thm ON thm.hold_id = th.id
    WHERE thm.table_id = ANY (v_table_ids)
      AND th.expires_at > v_now
      AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
      AND tstzrange(th.start_at, th.end_at, '[)') && v_window
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Hold conflict prevents assignment for booking %', p_booking_id
        USING ERRCODE = 'P0001',
              DETAIL = format('Hold % overlaps requested window', v_hold_conflict),
              HINT = 'Retry after hold expiration or confirm existing hold.';
    END IF;

    IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
      SELECT id
      INTO v_slot_id
      FROM public.booking_slots
      WHERE restaurant_id = v_restaurant_id
        AND slot_date = v_booking.booking_date
        AND slot_time = v_booking.start_time
      LIMIT 1;

      IF v_slot_id IS NULL THEN
        SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
        INTO v_slot_id;
      END IF;
    END IF;

    IF v_merge_group_supported AND v_table_count > 1 THEN
      v_merge_allocation_id := gen_random_uuid();

      BEGIN
        INSERT INTO public.allocations (
          id,
          booking_id,
          restaurant_id,
          resource_type,
          resource_id,
          "window",
          created_by,
          shadow,
          created_at,
          updated_at
        ) VALUES (
          v_merge_allocation_id,
          p_booking_id,
          v_restaurant_id,
          'merge_group',
          v_merge_allocation_id,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Merge group overlaps requested window for booking %s', p_booking_id);
      END;
    END IF;

    FOREACH v_table_id IN ARRAY v_table_ids LOOP
      IF v_merge_group_supported THEN
        BEGIN
          INSERT INTO public.booking_table_assignments (
            booking_id,
            table_id,
            slot_id,
            assigned_by,
            idempotency_key,
            merge_group_id
          ) VALUES (
            p_booking_id,
            v_table_id,
            v_slot_id,
            p_assigned_by,
            p_idempotency_key,
            v_merge_allocation_id
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      ELSE
        BEGIN
          INSERT INTO public.booking_table_assignments (
            booking_id,
            table_id,
            slot_id,
            assigned_by,
            idempotency_key
          ) VALUES (
            p_booking_id,
            v_table_id,
            v_slot_id,
            p_assigned_by,
            p_idempotency_key
          )
          ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
          SET assigned_at = v_now,
              assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
              idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
              slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id)
          RETURNING id INTO v_table_assignment_id;
        EXCEPTION
          WHEN unique_violation THEN
            RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id
              USING ERRCODE = 'P0001';
        END;
      END IF;

      BEGIN
        INSERT INTO public.allocations (
          booking_id,
          restaurant_id,
          resource_type,
          resource_id,
          "window",
          created_by,
          shadow,
          created_at,
          updated_at
        ) VALUES (
          p_booking_id,
          v_restaurant_id,
          'table',
          v_table_id,
          v_window,
          p_assigned_by,
          false,
          v_now,
          v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          RAISE EXCEPTION 'allocations_no_overlap'
            USING ERRCODE = 'P0001',
                  DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
      END;

      PERFORM public.refresh_table_status(v_table_id);

      table_id := v_table_id;
      start_at := v_start_at;
      end_at := v_end_at;
      merge_group_id := CASE WHEN v_merge_group_supported THEN v_merge_allocation_id ELSE NULL END;
      RETURN NEXT;
    END LOOP;

    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.booking_assignment_idempotency (
        booking_id,
        idempotency_key,
        table_ids,
        assignment_window,
        merge_group_allocation_id,
        created_at
      ) VALUES (
        p_booking_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        v_merge_allocation_id,
        v_now
      )
      ON CONFLICT (booking_id, idempotency_key) DO NOTHING;
    END IF;
  END;
  $$;


--
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- Name: assign_tables_atomic_v2(uuid, uuid[], text, boolean, uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text DEFAULT NULL::text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_booking RECORD;
    v_zone_id uuid;
    v_restaurant_id uuid;
    v_lock_zone int4;
    v_lock_bucket int4;
    v_now timestamptz := timezone('utc', now());
    v_table_ids uuid[];
    v_table_count integer;
    v_loaded_count integer := 0;
    v_slot_id uuid := NULL;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_window tstzrange;
    v_timezone text := NULL;
    v_merge_allocation_id uuid := NULL;
    v_table_assignment_id uuid;
    v_existing RECORD;
    v_adjacency_count integer;
    v_table_id uuid;
    v_merge_group_supported boolean := false;
    v_existing_zones uuid[] := ARRAY[]::uuid[];
    v_table_set_hash text;
    v_hold_conflict uuid;
    v_allocation_id uuid;
    v_capacity_check_enabled boolean := true;
    v_bucket_minutes integer := 60;
    v_bucket_start timestamptz;
    v_bucket_count integer := 0;
    v_total_capacity integer := 0;
  BEGIN
    IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one table id'
        USING ERRCODE = '23514';
    END IF;

    SELECT array_agg(DISTINCT t.table_id ORDER BY t.table_id)
    INTO v_table_ids
    FROM unnest(p_table_ids) AS t(table_id);

    IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires at least one valid table id'
        USING ERRCODE = '23514';
    END IF;

    v_table_count := array_length(v_table_ids, 1);
    v_table_set_hash := md5(array_to_string(v_table_ids, ','));

    SELECT b.*, r.timezone AS restaurant_timezone
    INTO v_booking
    FROM public.bookings b
    LEFT JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE b.id = p_booking_id
    FOR UPDATE OF b;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    v_restaurant_id := v_booking.restaurant_id;
    v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'booking_table_assignments'
        AND column_name = 'merge_group_id'
    ) INTO v_merge_group_supported;

    IF (p_start_at IS NULL) <> (p_end_at IS NULL) THEN
      RAISE EXCEPTION 'assign_tables_atomic_v2 requires both start and end when providing custom window'
        USING ERRCODE = '22023';
    END IF;

    IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL THEN
      v_start_at := p_start_at;
      v_end_at := p_end_at;
    ELSIF v_booking.start_at IS NOT NULL AND v_booking.end_at IS NOT NULL THEN
      v_start_at := v_booking.start_at;
      v_end_at := v_booking.end_at;
    ELSIF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL AND v_booking.end_time IS NOT NULL THEN
      v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.start_time)::int,
        EXTRACT(MINUTE FROM v_booking.start_time)::int,
        EXTRACT(SECOND FROM v_booking.start_time),
        v_timezone
      );
      v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM v_booking.booking_date)::int,
        EXTRACT(MONTH FROM v_booking.booking_date)::int,
        EXTRACT(DAY FROM v_booking.booking_date)::int,
        EXTRACT(HOUR FROM v_booking.end_time)::int,
        EXTRACT(MINUTE FROM v_booking.end_time)::int,
        EXTRACT(SECOND FROM v_booking.end_time),
        v_timezone
      );
    ELSE
      RAISE EXCEPTION 'Booking % missing start/end window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    IF v_start_at >= v_end_at THEN
      RAISE EXCEPTION 'Booking % has invalid time window', p_booking_id
        USING ERRCODE = '22000';
    END IF;

    v_window := tstzrange(v_start_at, v_end_at, '[)');

    -- Load and validate tables
    FOR v_table_id IN SELECT id FROM unnest(v_table_ids) AS t(id) LOOP
      PERFORM 1 FROM public.table_inventory ti WHERE ti.id = v_table_id AND ti.active IS TRUE FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Table % not found or inactive', v_table_id
          USING ERRCODE = 'P0002';
      END IF;
    END LOOP;

    -- Zone and mobility checks
    SELECT zone_id INTO v_zone_id FROM public.table_inventory WHERE id = v_table_ids[1];
    IF v_zone_id IS NULL THEN
      RAISE EXCEPTION 'Selected tables lack valid zone'
        USING ERRCODE = '23514';
    END IF;
    IF v_table_count > 1 AND EXISTS (
      SELECT 1 FROM public.table_inventory t WHERE t.id = ANY(v_table_ids) AND t.mobility <> 'movable'::public.table_mobility
    ) THEN
      RAISE EXCEPTION 'Merged assignments require movable tables'
        USING ERRCODE = '23514';
    END IF;

    -- Capacity validation: ensure sum(table capacities) >= party size
    SELECT COALESCE(SUM(capacity), 0) INTO v_total_capacity
    FROM public.table_inventory
    WHERE id = ANY(v_table_ids);
    IF v_total_capacity < COALESCE(v_booking.party_size, 0) THEN
      RAISE EXCEPTION 'capacity_insufficient_table_sum'
        USING ERRCODE = '23514',
              DETAIL = format('Selected capacity %s < party size %s', v_total_capacity, v_booking.party_size);
    END IF;

    -- Zone consistency with any pre-existing assignment
    SELECT array_agg(DISTINCT ti.zone_id)
    INTO v_existing_zones
    FROM public.booking_table_assignments existing
    JOIN public.table_inventory ti ON ti.id = existing.table_id
    WHERE existing.booking_id = p_booking_id;

    IF array_length(v_existing_zones, 1) IS NOT NULL AND array_length(v_existing_zones, 1) > 0 THEN
      IF EXISTS (SELECT 1 FROM unnest(v_existing_zones) AS z WHERE z IS DISTINCT FROM v_zone_id) THEN
        RAISE EXCEPTION 'Booking % already has assignments in a different zone', p_booking_id
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF v_booking.assigned_zone_id IS NULL THEN
      UPDATE public.bookings
      SET assigned_zone_id = v_zone_id,
          updated_at = v_now
      WHERE id = p_booking_id;
    ELSIF v_booking.assigned_zone_id IS DISTINCT FROM v_zone_id THEN
      RAISE EXCEPTION 'Booking % locked to zone %, cannot assign zone %', p_booking_id, v_booking.assigned_zone_id, v_zone_id
        USING ERRCODE = '23514';
    END IF;

    IF p_require_adjacency AND v_table_count > 1 THEN
      FOR v_table_id IN SELECT id FROM unnest(v_table_ids) AS t(id) LOOP
        SELECT COUNT(*) INTO v_adjacency_count
        FROM public.table_adjacencies
        WHERE (table_a = v_table_id AND table_b = ANY(v_table_ids) AND table_b <> v_table_id)
           OR (table_b = v_table_id AND table_a = ANY(v_table_ids) AND table_a <> v_table_id);
        IF COALESCE(v_adjacency_count, 0) = 0 THEN
          RAISE EXCEPTION 'Table % is not adjacent to the selected set', v_table_id
            USING ERRCODE = '23514';
        END IF;
      END LOOP;
    END IF;

    -- Acquire advisory locks for each hour bucket across [start,end)
    v_lock_zone := hashtext(COALESCE(v_zone_id::text, ''));
    v_bucket_start := date_trunc('hour', v_start_at);
    WHILE v_bucket_start < v_end_at LOOP
      v_lock_bucket := (EXTRACT(EPOCH FROM v_bucket_start)::bigint / 60)::int;
      PERFORM pg_advisory_xact_lock(v_lock_zone, v_lock_bucket);
      v_bucket_start := v_bucket_start + make_interval(mins => v_bucket_minutes);
      v_bucket_count := v_bucket_count + 1;
      IF v_bucket_count > 12 THEN
        EXIT; -- safety bound
      END IF;
    END LOOP;

    IF p_idempotency_key IS NOT NULL THEN
      SELECT * INTO v_existing
      FROM public.booking_assignment_idempotency
      WHERE booking_id = p_booking_id AND idempotency_key = p_idempotency_key;

      IF FOUND THEN
        IF v_existing.table_set_hash IS DISTINCT FROM v_table_set_hash THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 idempotency mismatch for booking %', p_booking_id
            USING ERRCODE = 'P0003', DETAIL = 'Idempotency key reuse detected with a different table set';
        END IF;

        RETURN QUERY
          SELECT bta.table_id,
                 COALESCE(bta.start_at, lower(v_existing.assignment_window)) AS start_at,
                 COALESCE(bta.end_at, upper(v_existing.assignment_window)) AS end_at,
                 v_existing.merge_group_allocation_id
          FROM public.booking_table_assignments bta
          WHERE bta.booking_id = p_booking_id
            AND bta.idempotency_key = p_idempotency_key
            AND bta.table_id = ANY (v_table_ids)
          ORDER BY bta.table_id;
        RETURN;
      END IF;
    END IF;

    SELECT th.id
    INTO v_hold_conflict
    FROM public.table_hold_windows thw
    JOIN public.table_holds th ON th.id = thw.hold_id
    WHERE thw.table_id = ANY (v_table_ids)
      AND thw.expires_at > v_now
      AND (th.booking_id IS NULL OR th.booking_id <> p_booking_id)
      AND thw.hold_window && v_window
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Hold conflict prevents assignment for booking %', p_booking_id
        USING ERRCODE = 'P0001',
              DETAIL = format('Hold % overlaps requested window', v_hold_conflict),
              HINT = 'Retry after hold expiration or confirm existing hold.';
    END IF;

    IF v_booking.booking_date IS NOT NULL AND v_booking.start_time IS NOT NULL THEN
      SELECT id INTO v_slot_id
      FROM public.booking_slots
      WHERE restaurant_id = v_restaurant_id
        AND slot_date = v_booking.booking_date
        AND slot_time = v_booking.start_time
      LIMIT 1;

      IF v_slot_id IS NULL THEN
        SELECT public.get_or_create_booking_slot(v_restaurant_id, v_booking.booking_date, v_booking.start_time, 999)
        INTO v_slot_id;
      END IF;
    END IF;

    IF v_merge_group_supported AND v_table_count > 1 THEN
      v_merge_allocation_id := gen_random_uuid();
      BEGIN
        INSERT INTO public.allocations (
          id, booking_id, restaurant_id, resource_type, resource_id, "window", created_by, shadow, created_at, updated_at
        ) VALUES (
          v_merge_allocation_id, p_booking_id, v_restaurant_id, 'merge_group', v_merge_allocation_id, v_window, p_assigned_by, false, v_now, v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now;
      EXCEPTION WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001', DETAIL = format('Merge group overlaps requested window for booking %s', p_booking_id);
      END;
    END IF;

    FOREACH v_table_id IN ARRAY v_table_ids LOOP
      BEGIN
        INSERT INTO public.allocations (
          booking_id, restaurant_id, resource_type, resource_id, "window", created_by, shadow, created_at, updated_at
        ) VALUES (
          p_booking_id, v_restaurant_id, 'table', v_table_id, v_window, p_assigned_by, false, v_now, v_now
        )
        ON CONFLICT ON CONSTRAINT allocations_booking_resource_key DO UPDATE
        SET "window" = EXCLUDED."window",
            created_by = COALESCE(EXCLUDED.created_by, public.allocations.created_by),
            updated_at = v_now
        RETURNING id INTO v_allocation_id;
      EXCEPTION WHEN unique_violation OR exclusion_violation THEN
        RAISE EXCEPTION 'allocations_no_overlap'
          USING ERRCODE = 'P0001', DETAIL = format('Resource %s overlaps requested window for booking %s', v_table_id, p_booking_id);
      END;

      BEGIN
        INSERT INTO public.booking_table_assignments (
          booking_id, table_id, slot_id, assigned_by, idempotency_key, merge_group_id, start_at, end_at, allocation_id
        ) VALUES (
          p_booking_id, v_table_id, v_slot_id, p_assigned_by, p_idempotency_key, v_merge_allocation_id, v_start_at, v_end_at, v_allocation_id
        )
        ON CONFLICT ON CONSTRAINT booking_table_assignments_booking_table_key DO UPDATE
        SET assigned_at = v_now,
            assigned_by = COALESCE(EXCLUDED.assigned_by, public.booking_table_assignments.assigned_by),
            idempotency_key = COALESCE(EXCLUDED.idempotency_key, public.booking_table_assignments.idempotency_key),
            merge_group_id = COALESCE(EXCLUDED.merge_group_id, public.booking_table_assignments.merge_group_id),
            slot_id = COALESCE(EXCLUDED.slot_id, public.booking_table_assignments.slot_id),
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            allocation_id = EXCLUDED.allocation_id,
            updated_at = v_now
        RETURNING id INTO v_table_assignment_id;
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.booking_table_assignments AS bta
        SET assigned_at = v_now,
            assigned_by = COALESCE(p_assigned_by, bta.assigned_by),
            idempotency_key = COALESCE(p_idempotency_key, bta.idempotency_key),
            merge_group_id = COALESCE(v_merge_allocation_id, bta.merge_group_id),
            slot_id = COALESCE(v_slot_id, bta.slot_id),
            start_at = v_start_at,
            end_at = v_end_at,
            allocation_id = COALESCE(v_allocation_id, bta.allocation_id),
            updated_at = v_now
        WHERE bta.booking_id = p_booking_id AND bta.table_id = v_table_id
        RETURNING bta.id INTO v_table_assignment_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'assign_tables_atomic_v2 assignment duplicate for table %', v_table_id USING ERRCODE = 'P0001';
        END IF;
      END;

      PERFORM public.refresh_table_status(v_table_id);

      table_id := v_table_id;
      start_at := v_start_at;
      end_at := v_end_at;
      merge_group_id := CASE WHEN v_merge_group_supported THEN v_merge_allocation_id ELSE NULL END;
      RETURN NEXT;
    END LOOP;

    IF p_idempotency_key IS NOT NULL THEN
      INSERT INTO public.booking_assignment_idempotency (
        booking_id, idempotency_key, table_ids, assignment_window, merge_group_allocation_id, table_set_hash, created_at
      ) VALUES (
        p_booking_id, p_idempotency_key, v_table_ids, v_window, v_merge_allocation_id, v_table_set_hash, v_now
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            merge_group_allocation_id = EXCLUDED.merge_group_allocation_id,
            table_set_hash = EXCLUDED.table_set_hash;
    END IF;

    IF current_setting('app.capacity.post_assignment.enabled', true) = 'off' THEN
      v_capacity_check_enabled := false;
    END IF;
    IF v_capacity_check_enabled THEN
      PERFORM public.validate_booking_capacity_after_assignment(p_booking_id);
    END IF;
  END;
  $$;


--
-- Name: FUNCTION assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_atomic_v2(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone) IS 'DEPRECATED: prefer assign_single_table() or assign_merged_tables().';


--
-- Name: assign_tables_backtracking(uuid, uuid[], text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_tables_backtracking(p_booking_id uuid, p_table_candidates uuid[], p_idempotency_key text DEFAULT NULL::text, p_require_adjacency boolean DEFAULT true, p_assigned_by uuid DEFAULT NULL::uuid) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  candidate uuid[];
  attempt int := 0;
  attempt_key text;
  last_error text := null;
begin
  if p_table_candidates is null or array_length(p_table_candidates, 1) is null then
    raise exception 'No candidate table sets supplied' using errcode = 'P0001';
  end if;

  foreach candidate slice 1 in array p_table_candidates loop
    if candidate is null or array_length(candidate, 1) is null then
      continue;
    end if;
    attempt := attempt + 1;
    attempt_key := case
      when p_idempotency_key is null then null
      else p_idempotency_key || '-alt' || lpad(attempt::text, 2, '0')
    end;
    begin
      return query
        select *
        from public.assign_tables_atomic_v2(
          p_booking_id,
          candidate,
          attempt_key,
          p_require_adjacency,
          p_assigned_by
        );
      return;
    exception
      when unique_violation or exclusion_violation then
        last_error := SQLERRM;
        continue;
      when others then
        last_error := SQLERRM;
        if position('allocations_no_overlap' in coalesce(SQLERRM, '')) > 0 then
          continue;
        end if;
        raise;
    end;
  end loop;

  raise exception 'allocations_no_overlap'
    using errcode = 'P0001', detail = coalesce(last_error, 'All candidate plans overlapped existing allocations');
end;
$$;


--
-- Name: FUNCTION assign_tables_backtracking(p_booking_id uuid, p_table_candidates uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.assign_tables_backtracking(p_booking_id uuid, p_table_candidates uuid[], p_idempotency_key text, p_require_adjacency boolean, p_assigned_by uuid) IS 'Attempts assign_tables_atomic_v2 for each provided table-set until one succeeds or all overlap existing allocations.';


--
-- Name: assignment_lock_claim(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_lock_claim(p_booking_id uuid, p_ttl_ms integer DEFAULT 30000, p_owner uuid DEFAULT gen_random_uuid()) RETURNS TABLE(acquired boolean, owner uuid, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now timestamptz := now();
  v_owner uuid := coalesce(p_owner, gen_random_uuid());
  v_ttl_ms integer := greatest(500, least(coalesce(p_ttl_ms, 30000), 300000));
  v_expires_at timestamptz := v_now + (v_ttl_ms || ' milliseconds')::interval;
  v_acquired boolean := false;
  v_owner_out uuid;
  v_expires_out timestamptz;
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking_id is required';
  END IF;

  INSERT INTO public.assignment_locks (booking_id, owner, expires_at, inserted_at)
  VALUES (p_booking_id, v_owner, v_expires_at, v_now)
  ON CONFLICT (booking_id) DO UPDATE
    SET owner = EXCLUDED.owner,
        expires_at = EXCLUDED.expires_at,
        inserted_at = EXCLUDED.inserted_at
    WHERE assignment_locks.expires_at <= v_now
  RETURNING assignment_locks.owner, assignment_locks.expires_at INTO v_owner_out, v_expires_out;

  IF v_owner_out IS NOT NULL THEN
    v_acquired := true;
  ELSE
    SELECT assignment_locks.owner, assignment_locks.expires_at INTO v_owner_out, v_expires_out
    FROM public.assignment_locks
    WHERE booking_id = p_booking_id;
  END IF;

  RETURN QUERY SELECT v_acquired, v_owner_out, v_expires_out;
END;
$$;


--
-- Name: assignment_lock_extend(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_lock_extend(p_booking_id uuid, p_owner uuid, p_ttl_ms integer) RETURNS TABLE(extended boolean, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_now timestamptz := now();
  v_ttl_ms integer := greatest(500, least(coalesce(p_ttl_ms, 30000), 300000));
  v_new_expires timestamptz := v_now + (v_ttl_ms || ' milliseconds')::interval;
  v_expires_out timestamptz;
  v_extended boolean := false;
BEGIN
  UPDATE public.assignment_locks
    SET expires_at = v_new_expires,
        inserted_at = v_now
  WHERE booking_id = p_booking_id
    AND owner = p_owner
    AND expires_at >= v_now
  RETURNING assignment_locks.expires_at INTO v_expires_out;

  IF FOUND THEN
    v_extended := true;
  ELSE
    SELECT assignment_locks.expires_at INTO v_expires_out
    FROM public.assignment_locks
    WHERE booking_id = p_booking_id;
  END IF;

  RETURN QUERY SELECT v_extended, v_expires_out;
END;
$$;


--
-- Name: assignment_lock_release(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assignment_lock_release(p_booking_id uuid, p_owner uuid) RETURNS TABLE(released boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.assignment_locks
  WHERE booking_id = p_booking_id
    AND owner = coalesce(p_owner, assignment_locks.owner)
  RETURNING true INTO released;

  IF NOT FOUND THEN
    released := false;
    RETURN NEXT;
  END IF;

  RETURN NEXT;
END;
$$;


--
-- Name: booking_status_summary(uuid, date, date, public.booking_status[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_status_filter public.booking_status[] DEFAULT NULL::public.booking_status[]) RETURNS TABLE(status public.booking_status, total bigint)
    LANGUAGE sql
    AS $$
    SELECT
        b.status,
        COUNT(*)::bigint AS total
    FROM public.bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND (p_start_date IS NULL OR b.booking_date >= p_start_date)
      AND (p_end_date IS NULL OR b.booking_date <= p_end_date)
      AND (p_status_filter IS NULL OR b.status = ANY(p_status_filter))
    GROUP BY b.status
    ORDER BY b.status;
$$;


--
-- Name: FUNCTION booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.booking_status_summary(p_restaurant_id uuid, p_start_date date, p_end_date date, p_status_filter public.booking_status[]) IS 'Returns aggregated booking counts by status for a restaurant across an optional date range and status filter.';


--
-- Name: confirm_hold_assignment_tx(uuid, uuid, text, boolean, uuid, timestamp with time zone, timestamp with time zone, text, text, public.booking_status, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_hold_assignment_tx(p_hold_id uuid, p_booking_id uuid, p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_window_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_window_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expected_policy_version text DEFAULT NULL::text, p_expected_adjacency_hash text DEFAULT NULL::text, p_target_status public.booking_status DEFAULT NULL::public.booking_status, p_history_reason text DEFAULT 'auto_assign_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb, p_history_changed_by uuid DEFAULT NULL::uuid) RETURNS TABLE(assignment_id uuid, table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_table_ids uuid[];
  v_zone_id uuid;
  v_policy_version text;
  v_snapshot_hash text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_window tstzrange;
  v_rows integer;
  v_booking_status public.booking_status;
  v_payload_checksum text;
  v_dedupe_key text;
  v_table_list text;
  v_hold_payload jsonb;
BEGIN
  IF p_window_start IS NULL AND p_window_end IS NOT NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_start IS NOT NULL AND p_window_end IS NULL THEN
    RAISE EXCEPTION 'confirm_hold_assignment_tx requires both start and end when providing custom window'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.table_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hold % not found', p_hold_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.booking_id IS NOT NULL AND v_hold.booking_id <> p_booking_id THEN
    RAISE EXCEPTION 'Hold % belongs to booking % (expected %)', p_hold_id, v_hold.booking_id, p_booking_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_hold.expires_at <= v_now THEN
    RAISE EXCEPTION 'Hold % expired at %', p_hold_id, v_hold.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(thm.table_id ORDER BY thm.table_id)
  INTO v_table_ids
  FROM public.table_hold_members thm
  WHERE thm.hold_id = p_hold_id;

  IF v_table_ids IS NULL OR array_length(v_table_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Hold % has no table members', p_hold_id
      USING ERRCODE = 'P0001';
  END IF;

  v_zone_id := v_hold.zone_id;
  v_policy_version := COALESCE((v_hold.metadata ->> 'policyVersion'), NULL);
  v_snapshot_hash := v_hold.metadata -> 'selection' -> 'snapshot' -> 'adjacency' ->> 'hash';

  IF p_expected_policy_version IS NOT NULL AND v_policy_version IS NOT NULL AND v_policy_version <> p_expected_policy_version THEN
    RAISE EXCEPTION 'Policy version changed (hold %, expected %, actual %)', p_hold_id, p_expected_policy_version, v_policy_version
      USING ERRCODE = 'P0003';
  END IF;

  IF p_expected_adjacency_hash IS NOT NULL AND v_snapshot_hash IS NOT NULL AND v_snapshot_hash <> p_expected_adjacency_hash THEN
    RAISE EXCEPTION 'Adjacency snapshot changed for hold %', p_hold_id
      USING ERRCODE = 'P0003';
  END IF;

  v_start_at := COALESCE(p_window_start, v_hold.start_at);
  v_end_at := COALESCE(p_window_end, v_hold.end_at);

  IF v_start_at IS NULL OR v_end_at IS NULL THEN
    RAISE EXCEPTION 'Hold % missing scheduling window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  IF v_start_at >= v_end_at THEN
    RAISE EXCEPTION 'Hold % has invalid window', p_hold_id
      USING ERRCODE = '22000';
  END IF;

  v_window := tstzrange(v_start_at, v_end_at, '[)');

  DROP TABLE IF EXISTS tmp_confirm_assignments_tx;
  CREATE TEMP TABLE tmp_confirm_assignments_tx ON COMMIT DROP AS
    SELECT *
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      v_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      v_start_at,
      v_end_at
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF p_target_status IS NOT NULL THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Booking % not found during transition', p_booking_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_booking_status <> p_target_status THEN
      PERFORM public.apply_booking_state_transition(
        p_booking_id,
        p_target_status,
        NULL,
        NULL,
        v_now,
        v_booking_status,
        p_target_status,
        p_history_changed_by,
        v_now,
        COALESCE(p_history_reason, 'auto_assign_confirm'),
        COALESCE(p_history_metadata, '{}'::jsonb)
      );
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_payload_checksum := encode(
      digest(
        jsonb_build_object(
          'bookingId', p_booking_id,
          'tableIds', v_table_ids,
          'startAt', v_start_at,
          'endAt', v_end_at,
          'actorId', p_assigned_by,
          'holdId', p_hold_id
        )::text,
        'sha256'
      ),
      'hex'
    );

    UPDATE public.booking_assignment_idempotency
      SET payload_checksum = v_payload_checksum
    WHERE booking_id = p_booking_id
      AND idempotency_key = p_idempotency_key;
  END IF;

  v_table_list := array_to_string(v_table_ids, ',');
  v_dedupe_key := format('%s:%s:%s:%s', p_booking_id, to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), v_table_list);

  BEGIN
    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.assignment.sync',
      v_dedupe_key,
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      jsonb_build_object(
        'bookingId', p_booking_id,
        'restaurantId', v_hold.restaurant_id,
        'tableIds', v_table_ids,
        'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'mergeGroupId', (SELECT tmp.merge_group_id FROM tmp_confirm_assignments_tx tmp LIMIT 1),
        'idempotencyKey', p_idempotency_key
      )
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    v_hold_payload := jsonb_build_object(
      'holdId', p_hold_id,
      'bookingId', p_booking_id,
      'restaurantId', v_hold.restaurant_id,
      'zoneId', v_zone_id,
      'tableIds', v_table_ids,
      'startAt', to_char(v_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(v_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'expiresAt', to_char(v_hold.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_assigned_by,
      'metadata', v_hold.metadata
    );

    INSERT INTO public.capacity_outbox (
      event_type,
      dedupe_key,
      restaurant_id,
      booking_id,
      idempotency_key,
      payload
    ) VALUES (
      'capacity.hold.confirmed',
      format('%s:%s:hold.confirmed', p_booking_id, p_hold_id),
      v_hold.restaurant_id,
      p_booking_id,
      p_idempotency_key,
      v_hold_payload
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  IF p_idempotency_key IS NOT NULL THEN
    BEGIN
      INSERT INTO public.booking_confirmation_results (
        booking_id,
        hold_id,
        restaurant_id,
        idempotency_key,
        table_ids,
        assignment_window,
        actor_id,
        metadata
      ) VALUES (
        p_booking_id,
        p_hold_id,
        v_hold.restaurant_id,
        p_idempotency_key,
        v_table_ids,
        v_window,
        p_assigned_by,
        v_hold.metadata
      )
      ON CONFLICT (booking_id, idempotency_key) DO UPDATE
        SET table_ids = EXCLUDED.table_ids,
            assignment_window = EXCLUDED.assignment_window,
            restaurant_id = EXCLUDED.restaurant_id,
            hold_id = EXCLUDED.hold_id,
            actor_id = EXCLUDED.actor_id,
            metadata = EXCLUDED.metadata,
            created_at = EXCLUDED.created_at;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  DELETE FROM public.table_holds WHERE id = p_hold_id;

  RETURN QUERY
    SELECT bta.id,
           tmp.table_id,
           tmp.start_at,
           tmp.end_at,
           tmp.merge_group_id
    FROM tmp_confirm_assignments_tx tmp
    JOIN public.booking_table_assignments bta
      ON bta.booking_id = p_booking_id
     AND bta.table_id = tmp.table_id;
END;
$$;


--
-- Name: confirm_hold_assignment_with_transition(uuid, uuid[], text, boolean, uuid, timestamp with time zone, timestamp with time zone, public.booking_status, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_hold_assignment_with_transition(p_booking_id uuid, p_table_ids uuid[], p_idempotency_key text, p_require_adjacency boolean DEFAULT false, p_assigned_by uuid DEFAULT NULL::uuid, p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_target_status public.booking_status DEFAULT 'confirmed'::public.booking_status, p_history_changed_by uuid DEFAULT NULL::uuid, p_history_reason text DEFAULT 'auto_assign_atomic_confirm'::text, p_history_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(table_id uuid, start_at timestamp with time zone, end_at timestamp with time zone, merge_group_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_history_from public.booking_status;
  v_now timestamptz := timezone('utc', now());
  v_transition_needed boolean := true;
BEGIN
  SELECT status INTO v_history_from
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  DROP TABLE IF EXISTS tmp_confirm_assignments;
  CREATE TEMP TABLE tmp_confirm_assignments ON COMMIT DROP AS
    SELECT ata.table_id, ata.start_at, ata.end_at, ata.merge_group_id
    FROM public.assign_tables_atomic_v2(
      p_booking_id,
      p_table_ids,
      p_idempotency_key,
      p_require_adjacency,
      p_assigned_by,
      p_start_at,
      p_end_at
    ) AS ata;

  IF NOT EXISTS (SELECT 1 FROM tmp_confirm_assignments) THEN
    RAISE EXCEPTION 'assign_tables_atomic_v2 returned no assignments for booking %', p_booking_id
      USING ERRCODE = 'P0003';
  END IF;

  IF v_history_from = p_target_status THEN
    v_transition_needed := false;
  END IF;

  IF v_transition_needed THEN
    PERFORM public.apply_booking_state_transition(
      p_booking_id,
      p_target_status,
      NULL,
      NULL,
      v_now,
      v_history_from,
      p_target_status,
      p_history_changed_by,
      v_now,
      COALESCE(p_history_reason, 'auto_assign_atomic_confirm'),
      COALESCE(p_history_metadata, '{}'::jsonb)
    );
  END IF;

  RETURN QUERY
    SELECT t.table_id, t.start_at, t.end_at, t.merge_group_id
    FROM tmp_confirm_assignments AS t;
END;
$$;


--
-- Name: create_booking_with_capacity_check(uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, text, text, uuid, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text DEFAULT NULL::text, p_marketing_opt_in boolean DEFAULT false, p_idempotency_key text DEFAULT NULL::text, p_source text DEFAULT 'api'::text, p_auth_user_id uuid DEFAULT NULL::uuid, p_client_request_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb, p_loyalty_points_awarded integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_service_period_id uuid;
    v_service_period_name text;
    v_max_covers integer;
    v_max_parties integer;
    v_booked_covers integer;
    v_booked_parties integer;
    v_booking_id uuid;
    v_booking_record jsonb;
    v_reference text;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_timezone text;
    v_timezone_raw text;
    v_allow_after_hours boolean;
    v_local_start timestamp without time zone;
    v_local_end timestamp without time zone;
    v_local_day smallint;
    v_is_open boolean;
    v_has_closure boolean;
BEGIN
    -- =====================================================
    -- STEP 1: Idempotency Check
    -- =====================================================
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_booking_id
        FROM bookings
        WHERE restaurant_id = p_restaurant_id
          AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            SELECT to_jsonb(b.*) INTO v_booking_record
            FROM bookings b
            WHERE id = v_booking_id;

            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'booking', v_booking_record,
                'message', 'Booking already exists (idempotency)'
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 2: Find Applicable Service Period
    -- =====================================================
    SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
    FROM restaurant_service_periods sp
    WHERE sp.restaurant_id = p_restaurant_id
      AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
      AND p_start_time >= sp.start_time
      AND p_start_time < sp.end_time
    ORDER BY
      sp.day_of_week DESC NULLS LAST,
      sp.start_time ASC
    LIMIT 1;

    -- =====================================================
    -- STEP 3: Timezone & Operating Hours Validation
    -- =====================================================
    SELECT timezone INTO v_timezone_raw
    FROM restaurants
    WHERE id = p_restaurant_id;

    v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '');

    IF v_timezone_raw = '' THEN
        v_timezone := 'Europe/London';
    ELSE
        SELECT name INTO v_timezone
        FROM pg_timezone_names
        WHERE lower(name) = lower(v_timezone_raw)
        LIMIT 1;

        IF NOT FOUND OR v_timezone IS NULL THEN
            v_timezone := 'Europe/London';
        END IF;
    END IF;

    v_start_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_start_time)::int,
        EXTRACT(MINUTE FROM p_start_time)::int,
        EXTRACT(SECOND FROM p_start_time),
        v_timezone
    );

    v_end_at := make_timestamptz(
        EXTRACT(YEAR FROM p_booking_date)::int,
        EXTRACT(MONTH FROM p_booking_date)::int,
        EXTRACT(DAY FROM p_booking_date)::int,
        EXTRACT(HOUR FROM p_end_time)::int,
        EXTRACT(MINUTE FROM p_end_time)::int,
        EXTRACT(SECOND FROM p_end_time),
        v_timezone
    );

    v_local_start := (v_start_at AT TIME ZONE v_timezone);
    v_local_end := (v_end_at AT TIME ZONE v_timezone);
    v_local_day := EXTRACT(ISODOW FROM v_local_start)::smallint;

    SELECT allow_after_hours
    INTO v_allow_after_hours
    FROM service_policy
    ORDER BY created_at DESC
    LIMIT 1;

    v_allow_after_hours := COALESCE(v_allow_after_hours, false);

    IF NOT v_allow_after_hours THEN
        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = true
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
        ) INTO v_has_closure;

        IF v_has_closure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The restaurant is closed during the requested window.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM restaurant_operating_hours h
            WHERE h.restaurant_id = p_restaurant_id
              AND h.is_closed = false
              AND (
                    (h.effective_date IS NOT NULL AND h.effective_date = v_local_start::date)
                 OR (h.effective_date IS NULL AND h.day_of_week = v_local_day)
              )
              AND v_local_start::time >= h.opens_at
              AND v_local_start::time < h.closes_at
        ) INTO v_is_open;

        IF NOT v_is_open THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_OUTSIDE_OPERATING_HOURS',
                'message', 'The requested time is outside configured operating hours.',
                'retryable', false,
                'details', jsonb_build_object(
                    'requestedStart', to_char(v_local_start, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'requestedEnd', to_char(v_local_end, 'YYYY-MM-DD"T"HH24:MI:SS'),
                    'timezone', v_timezone,
                    'allowAfterHours', v_allow_after_hours
                )
            );
        END IF;
    END IF;

    -- =====================================================
    -- STEP 4: Get Capacity Rules with Row-Level Lock
    -- =====================================================
    SELECT
        COALESCE(cr.max_covers, 999999) AS max_covers,
        COALESCE(cr.max_parties, 999999) AS max_parties
    INTO v_max_covers, v_max_parties
    FROM restaurant_capacity_rules cr
    WHERE cr.restaurant_id = p_restaurant_id
      AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
      AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
      AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
    ORDER BY
      cr.effective_date DESC NULLS LAST,
      cr.day_of_week DESC NULLS LAST,
      cr.service_period_id DESC NULLS LAST
    LIMIT 1
    FOR UPDATE NOWAIT;

    v_max_covers := COALESCE(v_max_covers, 999999);
    v_max_parties := COALESCE(v_max_parties, 999999);

    -- =====================================================
    -- STEP 5: Count Existing Bookings in Same Period
    -- =====================================================
    SELECT
        COALESCE(SUM(b.party_size), 0) AS total_covers,
        COUNT(*) AS total_parties
    INTO v_booked_covers, v_booked_parties
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date = p_booking_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND (
            v_service_period_id IS NULL
         OR b.start_time >= (
                SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
         AND b.start_time < (
                SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id
            )
      );

    -- =====================================================
    -- STEP 6: Capacity Validation
    -- =====================================================
    IF v_booked_covers + p_party_size > v_max_covers THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum capacity of %s covers exceeded. Currently booked: %s, Requested: %s',
                v_max_covers, v_booked_covers, p_party_size),
            'details', jsonb_build_object(
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers,
                'requestedCovers', p_party_size,
                'availableCovers', v_max_covers - v_booked_covers,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    IF v_booked_parties + 1 > v_max_parties THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CAPACITY_EXCEEDED',
            'message', format('Maximum of %s bookings exceeded for this period. Currently booked: %s',
                v_max_parties, v_booked_parties),
            'details', jsonb_build_object(
                'maxParties', v_max_parties,
                'bookedParties', v_booked_parties,
                'availableParties', v_max_parties - v_booked_parties,
                'servicePeriod', v_service_period_name
            )
        );
    END IF;

    v_reference := public.generate_booking_reference();

    INSERT INTO bookings (
        restaurant_id,
        customer_id,
        booking_date,
        start_time,
        end_time,
        start_at,
        end_at,
        party_size,
        booking_type,
        seating_preference,
        status,
        reference,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        marketing_opt_in,
        loyalty_points_awarded,
        source,
        auth_user_id,
        idempotency_key,
        details
    ) VALUES (
        p_restaurant_id,
        p_customer_id,
        p_booking_date,
        p_start_time,
        p_end_time,
        v_start_at,
        v_end_at,
        p_party_size,
        p_booking_type::booking_type,
        p_seating_preference::seating_preference_type,
        'confirmed'::booking_status,
        v_reference,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_notes,
        p_marketing_opt_in,
        p_loyalty_points_awarded,
        p_source,
        p_auth_user_id,
        p_idempotency_key,
        jsonb_build_object(
            'channel', 'api.capacity_safe',
            'client_request_id', p_client_request_id,
            'capacity_check', jsonb_build_object(
                'service_period_id', v_service_period_id,
                'max_covers', v_max_covers,
                'booked_covers_before', v_booked_covers,
                'booked_covers_after', v_booked_covers + p_party_size
            ),
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        ) || COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id, to_jsonb(bookings.*) INTO v_booking_id, v_booking_record;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'booking', v_booking_record,
        'capacity', jsonb_build_object(
            'servicePeriod', v_service_period_name,
            'maxCovers', v_max_covers,
            'bookedCovers', v_booked_covers + p_party_size,
            'availableCovers', v_max_covers - (v_booked_covers + p_party_size),
            'utilizationPercent', ROUND(((v_booked_covers + p_party_size)::numeric / v_max_covers) * 100, 1)
        ),
        'message', 'Booking created successfully'
    );

EXCEPTION
    WHEN serialization_failure THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Concurrent booking conflict detected. Please retry.',
            'retryable', true
        );

    WHEN deadlock_detected THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Database deadlock detected. Please retry.',
            'retryable', true
        );

    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'BOOKING_CONFLICT',
            'message', 'Capacity rule is currently locked by another transaction. Please retry.',
            'retryable', true
        );

    WHEN OTHERS THEN
        RAISE WARNING 'Unexpected error in create_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INTERNAL_ERROR',
            'message', 'An unexpected error occurred while creating the booking',
            'retryable', false,
            'sqlstate', SQLSTATE,
            'sqlerrm', SQLERRM,
            'timezone', v_timezone,
            'original_timezone', NULLIF(v_timezone_raw, '')
        );
END;
$$;


--
-- Name: FUNCTION create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_booking_with_capacity_check(p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text, p_marketing_opt_in boolean, p_idempotency_key text, p_source text, p_auth_user_id uuid, p_client_request_id text, p_details jsonb, p_loyalty_points_awarded integer) IS 'Race-safe booking creation enforcing capacity and operating hours. Returns JSON response with success/error detail.';


--
-- Name: current_restaurant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_restaurant_id() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := nullif(current_setting('app.restaurant_id', true), '');
  IF v_raw IS NULL THEN
    v_raw := nullif(current_setting('request.header.x-restaurant-id', true), '');
  END IF;

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid restaurant context value'
      USING ERRCODE = '22023',
            DETAIL = format('app.restaurant_id=%L', v_raw);
END;
$$;


--
-- Name: FUNCTION current_restaurant_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_restaurant_id() IS 'Returns the tenant/restaurant scope extracted from app.restaurant_id GUC or the X-Restaurant-Id header.';


--
-- Name: enforce_bar_drinks_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_bar_drinks_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_booking_type bookings.booking_type%TYPE;
  v_table_category table_inventory.category%TYPE;
  v_zone_name text;
BEGIN
  SELECT b.booking_type INTO v_booking_type
  FROM public.bookings b
  WHERE b.id = NEW.booking_id
  LIMIT 1;

  IF v_booking_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.category, z.name
  INTO v_table_category, v_zone_name
  FROM public.table_inventory t
  LEFT JOIN public.zones z ON z.id = t.zone_id
  WHERE t.id = NEW.table_id
  LIMIT 1;

  IF v_table_category IS NULL THEN
    RETURN NEW;
  END IF;

  IF (v_table_category = 'bar'::public.table_category OR v_zone_name ILIKE 'bar%')
     AND v_booking_type <> 'drinks' THEN
    RAISE EXCEPTION 'Bar tables are drinks-only; booking_type % is not allowed', v_booking_type
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_booking_reference() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O/1/I
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: get_or_create_booking_slot(uuid, date, time without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer DEFAULT 999) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_slot_id uuid;
  v_service_period_id uuid;
  v_capacity integer;
  v_rules_exist boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
BEGIN
  SELECT id
  INTO v_slot_id
  FROM public.booking_slots
  WHERE restaurant_id = p_restaurant_id
    AND slot_date = p_slot_date
    AND slot_time = p_slot_time;

  IF FOUND THEN
    RETURN v_slot_id;
  END IF;

  SELECT id
  INTO v_service_period_id
  FROM public.restaurant_service_periods
  WHERE restaurant_id = p_restaurant_id
    AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
    AND p_slot_time >= start_time
    AND p_slot_time < end_time
  ORDER BY day_of_week DESC NULLS LAST, start_time ASC
  LIMIT 1;

  IF v_rules_exist THEN
    SELECT COALESCE(max_covers, p_default_capacity)
    INTO v_capacity
    FROM public.restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
      AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
      AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
      AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY effective_date DESC NULLS LAST,
             day_of_week DESC NULLS LAST,
             service_period_id DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_capacity := COALESCE(v_capacity, p_default_capacity);

  INSERT INTO public.booking_slots (
    restaurant_id,
    slot_date,
    slot_time,
    service_period_id,
    available_capacity,
    reserved_count
  ) VALUES (
    p_restaurant_id,
    p_slot_date,
    p_slot_time,
    v_service_period_id,
    v_capacity,
    0
  )
  ON CONFLICT ON CONSTRAINT booking_slots_restaurant_slot_key DO UPDATE
    SET service_period_id = EXCLUDED.service_period_id,
        available_capacity = greatest(public.booking_slots.available_capacity, EXCLUDED.available_capacity),
        updated_at = timezone('utc', now())
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;


--
-- Name: FUNCTION get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_or_create_booking_slot(p_restaurant_id uuid, p_slot_date date, p_slot_time time without time zone, p_default_capacity integer) IS 'Get existing slot or create new one with capacity override fallback (works even if restaurant_capacity_rules is absent).';


--
-- Name: increment_booking_slot_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_booking_slot_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only increment version if reserved_count changed
    IF OLD.reserved_count IS DISTINCT FROM NEW.reserved_count THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION increment_booking_slot_version(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.increment_booking_slot_version() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';


--
-- Name: is_holds_strict_conflicts_enabled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_holds_strict_conflicts_enabled() RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  setting text;
BEGIN
  setting := current_setting('app.holds.strict_conflicts.enabled', true);
  IF setting IS NULL OR length(trim(setting)) = 0 THEN
    RETURN true;
  END IF;
  RETURN lower(setting) IN ('on', 'true', '1', 't');
END;
$$;


--
-- Name: is_table_available_v2(uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_table_available_v2(p_table_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.booking_table_assignments bta
  JOIN public.bookings b ON b.id = bta.booking_id
  WHERE bta.table_id = p_table_id
    AND tstzrange(bta.start_at, bta.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND b.status IN ('pending', 'confirmed', 'checked_in')
);
$$;


--
-- Name: log_table_assignment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_table_assignment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Log to audit_logs table if it exists
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            NEW.id::text,
            'assigned',
            NEW.assigned_by::text,
            jsonb_build_object(
                'booking_id', NEW.booking_id,
                'table_id', NEW.table_id,
                'slot_id', NEW.slot_id
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity, entity_id, action, actor, metadata)
        VALUES (
            'booking_table_assignment',
            OLD.id::text,
            'unassigned',
            OLD.assigned_by::text,
            jsonb_build_object(
                'booking_id', OLD.booking_id,
                'table_id', OLD.table_id,
                'slot_id', OLD.slot_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: FUNCTION log_table_assignment_change(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_table_assignment_change() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';


--
-- Name: on_allocations_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_allocations_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_table uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(OLD.resource_id);
        END IF;
      ELSE
        IF NEW.resource_type = 'table' THEN
          PERFORM public.refresh_table_status(NEW.resource_id);
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;


--
-- Name: on_booking_status_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_booking_status_refresh() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_table_id uuid;
    BEGIN
      IF TG_OP <> 'UPDATE' OR NEW.status = OLD.status THEN
        RETURN NEW;
      END IF;

      FOR v_table_id IN
        SELECT table_id
        FROM public.booking_table_assignments
        WHERE booking_id = NEW.id
      LOOP
        PERFORM public.refresh_table_status(v_table_id);
      END LOOP;

      RETURN NEW;
    END;
    $$;


--
-- Name: process_late_arrivals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_late_arrivals() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  late_booking_ids uuid[];
BEGIN
  -- Select all booking IDs that are confirmed and where the start time is more than 15 minutes in the past
  SELECT array_agg(id)
  INTO late_booking_ids
  FROM public.bookings
  WHERE
    status = 'confirmed'
    AND start_at < (timezone('utc', now()) - INTERVAL '15 minutes');

  IF array_length(late_booking_ids, 1) > 0 THEN
    -- Remove all table assignments for the identified late bookings to free up the tables
    DELETE FROM public.booking_table_assignments
    WHERE booking_id = ANY(late_booking_ids);

    -- Remove associated allocations to free up the resources for conflict checks
    DELETE FROM public.allocations
    WHERE booking_id = ANY(late_booking_ids);

    -- Update the status of the late bookings to PRIORITY_WAITLIST
    UPDATE public.bookings
    SET status = 'PRIORITY_WAITLIST'
    WHERE id = ANY(late_booking_ids);
  END IF;
END;
$$;


--
-- Name: prune_allocations_history(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_allocations_history(p_cutoff timestamp with time zone, p_limit integer DEFAULT 500) RETURNS TABLE(archived_count integer, deleted_count integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  WITH candidates AS (
    SELECT
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance
    FROM public.allocations
    WHERE upper("window") < p_cutoff
    ORDER BY updated_at
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.allocations_archive (
      id,
      booking_id,
      resource_type,
      resource_id,
      created_at,
      updated_at,
      shadow,
      restaurant_id,
      "window",
      created_by,
      is_maintenance,
      archived_at
    )
    SELECT
      c.id,
      c.booking_id,
      c.resource_type,
      c.resource_id,
      c.created_at,
      c.updated_at,
      c.shadow,
      c.restaurant_id,
      c."window",
      c.created_by,
      c.is_maintenance,
      timezone('utc'::text, now())
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ), deleted AS (
    DELETE FROM public.allocations a
    USING inserted i
    WHERE a.id = i.id
    RETURNING a.id
  )
  SELECT * INTO archived_count, deleted_count FROM (
    SELECT
      COALESCE((SELECT count(*) FROM inserted), 0)::integer AS archived_count,
      COALESCE((SELECT count(*) FROM deleted), 0)::integer AS deleted_count
  ) subq;
  
  RETURN QUERY SELECT archived_count, deleted_count;
END;
$$;


--
-- Name: record_observability_event(text, text, text, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_observability_event(p_source text, p_event_type text, p_severity text DEFAULT 'info'::text, p_restaurant_id uuid DEFAULT NULL::uuid, p_booking_id uuid DEFAULT NULL::uuid, p_context jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.observability_events (
    source,
    event_type,
    severity,
    restaurant_id,
    booking_id,
    context
  ) VALUES (
    p_source,
    p_event_type,
    COALESCE(p_severity, 'info'),
    p_restaurant_id,
    p_booking_id,
    COALESCE(p_context, '{}'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE WARNING 'Failed to record observability event: %', SQLERRM;
END;
$$;


--
-- Name: refresh_table_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_table_status(p_table_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_has_checked_in boolean;
    v_has_current_allocation boolean;
  BEGIN
    IF p_table_id IS NULL THEN
      RETURN;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.allocations a
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND a.is_maintenance
        AND a."window" @> now()
    ) THEN
      UPDATE public.table_inventory
      SET status = 'out_of_service'
      WHERE id = p_table_id;
      RETURN;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.allocations a
      JOIN public.bookings b ON b.id = a.booking_id
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND b.status = 'checked_in'
        AND a."window" @> now()
    ) INTO v_has_checked_in;

    IF v_has_checked_in THEN
      UPDATE public.table_inventory
      SET status = 'occupied'
      WHERE id = p_table_id
        AND status <> 'out_of_service';
      RETURN;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.allocations a
      WHERE a.resource_type = 'table'
        AND a.resource_id = p_table_id
        AND a."window" @> now()
    ) INTO v_has_current_allocation;

    IF v_has_current_allocation THEN
      UPDATE public.table_inventory
      SET status = 'reserved'
      WHERE id = p_table_id
        AND status NOT IN ('occupied', 'out_of_service');
    ELSE
      UPDATE public.table_inventory
      SET status = 'available'
      WHERE id = p_table_id
        AND status <> 'out_of_service';
    END IF;
  END;
  $$;


--
-- Name: release_hold_and_emit(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_hold_and_emit(p_hold_id uuid, p_actor_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_hold public.table_holds%ROWTYPE;
  v_members jsonb;
BEGIN
  SELECT * INTO v_hold
    FROM public.table_holds
    WHERE id = p_hold_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Capture member table IDs BEFORE deletion
  SELECT COALESCE(jsonb_agg(table_id), '[]'::jsonb) INTO v_members
    FROM public.table_hold_members
    WHERE hold_id = p_hold_id;

  -- Now delete in proper order
  DELETE FROM public.table_hold_members
    WHERE hold_id = p_hold_id;
  DELETE FROM public.table_holds
    WHERE id = p_hold_id;

  PERFORM public.record_observability_event(
    'capacity.holds',
    'hold.released',
    'info',
    v_hold.restaurant_id,
    v_hold.booking_id,
    jsonb_build_object(
      'holdId', p_hold_id,
      'actorId', p_actor_id,
      'tableIds', v_members,
      'startAt', v_hold.start_at,
      'endAt', v_hold.end_at,
      'expiresAt', v_hold.expires_at
    )
  );

  RETURN true;
END;
$$;


--
-- Name: require_restaurant_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_restaurant_context() RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  v_restaurant_id := public.current_restaurant_id();
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_restaurant_id;
END;
$$;


--
-- Name: FUNCTION require_restaurant_context(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.require_restaurant_context() IS 'Raises if no tenant context is present (used by RLS policies).';


--
-- Name: set_booking_instants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_instants() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  tz text;
  sh int; sm int; ss double precision;
  eh int; em int; es double precision;
BEGIN
  SELECT timezone INTO tz FROM public.restaurants WHERE id = NEW.restaurant_id;

  sh := EXTRACT(HOUR   FROM NEW.start_time)::int;
  sm := EXTRACT(MINUTE FROM NEW.start_time)::int;
  ss := EXTRACT(SECOND FROM NEW.start_time);
  eh := EXTRACT(HOUR   FROM NEW.end_time)::int;
  em := EXTRACT(MINUTE FROM NEW.end_time)::int;
  es := EXTRACT(SECOND FROM NEW.end_time);

  NEW.start_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    sh, sm, ss, tz
                  );

  NEW.end_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    eh, em, es, tz
               );

  RETURN NEW;
END;
$$;


--
-- Name: set_booking_reference(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_booking_reference() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE ref text;
BEGIN
  IF COALESCE(NEW.reference,'') = '' THEN
    LOOP
      ref := public.generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE reference = ref);
    END LOOP;
    NEW.reference := ref;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_hold_conflict_enforcement(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_hold_conflict_enforcement(enabled boolean) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Changed from 'true' (transaction-scoped) to 'false' (session-scoped)
  -- so the setting persists for the entire database connection
  PERFORM set_config(
    'app.holds.strict_conflicts.enabled',
    CASE WHEN enabled THEN 'on' ELSE 'off' END,
    false  -- SESSION-scoped (not transaction-scoped)
  );
  RETURN enabled;
END;
$$;


--
-- Name: FUNCTION set_hold_conflict_enforcement(enabled boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_hold_conflict_enforcement(enabled boolean) IS 'Sets the hold conflict enforcement flag for the current database session.
Session-scoped to persist across multiple queries in the same connection.';


--
-- Name: set_restaurant_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_restaurant_context(p_restaurant_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_restaurant_id IS NULL THEN
    PERFORM set_config('app.restaurant_id', '', false);
    RETURN NULL;
  END IF;
  PERFORM set_config('app.restaurant_id', p_restaurant_id::text, false);
  RETURN p_restaurant_id;
END;
$$;


--
-- Name: FUNCTION set_restaurant_context(p_restaurant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_restaurant_context(p_restaurant_id uuid) IS 'Allows edge functions / trusted callers to set the tenant context for the current session.';


--
-- Name: set_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_table_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_table_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    table_id uuid NOT NULL,
    slot_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    allocation_id uuid,
    merge_group_id uuid,
    assignment_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);


--
-- Name: TABLE booking_table_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_table_assignments IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';


--
-- Name: COLUMN booking_table_assignments.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.booking_id IS 'The booking being assigned a table';


--
-- Name: COLUMN booking_table_assignments.table_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.table_id IS 'The physical table being assigned';


--
-- Name: COLUMN booking_table_assignments.slot_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.slot_id IS 'Optional link to the booking slot (for slot-level tracking)';


--
-- Name: COLUMN booking_table_assignments.assigned_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_at IS 'When the assignment was made';


--
-- Name: COLUMN booking_table_assignments.assigned_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.assigned_by IS 'User who made the assignment (null for auto-assignment)';


--
-- Name: COLUMN booking_table_assignments.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.notes IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';


--
-- Name: COLUMN booking_table_assignments.allocation_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_table_assignments.allocation_id IS 'Allocation row backing the assignment; used for overlap enforcement.';


--
-- Name: sync_confirmed_assignment_windows(uuid, uuid[], timestamp with time zone, timestamp with time zone, uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_confirmed_assignment_windows(p_booking_id uuid, p_table_ids uuid[], p_window_start timestamp with time zone, p_window_end timestamp with time zone, p_actor_id uuid DEFAULT NULL::uuid, p_hold_id uuid DEFAULT NULL::uuid, p_merge_group_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_payload_checksum text DEFAULT NULL::text) RETURNS SETOF public.booking_table_assignments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window tstzrange := tstzrange(p_window_start, p_window_end, '[)');
BEGIN
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'sync_confirmed_assignment_windows requires booking id';
  END IF;

  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) IS NULL THEN
    RETURN QUERY
      SELECT *
      FROM public.booking_table_assignments
      WHERE booking_id = p_booking_id;
    RETURN;
  END IF;

  UPDATE public.booking_table_assignments
     SET start_at = p_window_start,
         end_at = p_window_end
   WHERE booking_id = p_booking_id
     AND table_id = ANY(p_table_ids);

  UPDATE public.allocations
     SET "window" = v_window,
         merge_group_id = COALESCE(p_merge_group_id, merge_group_id)
   WHERE booking_id = p_booking_id
     AND resource_type = 'table'
     AND resource_id = ANY(p_table_ids);

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE public.booking_assignment_idempotency
       SET assignment_window = v_window,
           merge_group_allocation_id = p_merge_group_id,
           payload_checksum = p_payload_checksum
     WHERE booking_id = p_booking_id
       AND idempotency_key = p_idempotency_key;
  END IF;

  INSERT INTO public.capacity_outbox (
    event_type,
    dedupe_key,
    restaurant_id,
    booking_id,
    idempotency_key,
    payload
  )
  SELECT
    'capacity.assignment.window_synced',
    format('%s:%s:window_synced', p_booking_id, coalesce(p_hold_id, 'none')),
    b.restaurant_id,
    p_booking_id,
    p_idempotency_key,
    jsonb_build_object(
      'bookingId', p_booking_id,
      'tableIds', p_table_ids,
      'startAt', to_char(p_window_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'endAt', to_char(p_window_end AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'actorId', p_actor_id,
      'holdId', p_hold_id,
      'mergeGroupId', p_merge_group_id
    )
  FROM public.bookings b
  WHERE b.id = p_booking_id
  ON CONFLICT ON CONSTRAINT capacity_outbox_dedupe_unique DO NOTHING;

  RETURN QUERY
    SELECT *
      FROM public.booking_table_assignments
     WHERE booking_id = p_booking_id
       AND table_id = ANY(p_table_ids);
END;
$$;


--
-- Name: sync_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  hold_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_hold_windows
    WHERE hold_id = OLD.hold_id AND table_id = OLD.table_id;
    RETURN OLD;
  END IF;

  -- For INSERT, get the parent hold details
  SELECT id, restaurant_id, booking_id, start_at, end_at, expires_at
  INTO hold_row
  FROM public.table_holds
  WHERE id = NEW.hold_id;

  IF hold_row IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.table_hold_windows (hold_id, table_id, restaurant_id, booking_id, start_at, end_at, expires_at)
  VALUES (
    NEW.hold_id,
    NEW.table_id,
    hold_row.restaurant_id,
    hold_row.booking_id,
    hold_row.start_at,
    hold_row.end_at,
    hold_row.expires_at
  )
  ON CONFLICT (hold_id, table_id) DO UPDATE SET
    restaurant_id = EXCLUDED.restaurant_id,
    booking_id = EXCLUDED.booking_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    expires_at = EXCLUDED.expires_at;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_table_hold_windows(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_table_hold_windows() IS 'Trigger function to maintain table_hold_windows for conflict detection.
Always populates the table regardless of GUC setting to ensure exclusion constraint works.
Application-level code controls whether strict conflicts are enforced via feature flags.';


--
-- Name: unassign_table_from_booking(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_deleted boolean;
BEGIN
    -- Delete assignment
    DELETE FROM booking_table_assignments
    WHERE booking_id = p_booking_id
        AND table_id = p_table_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    IF v_deleted THEN
        -- Update table status to available
        UPDATE table_inventory
        SET status = 'available'::table_status
        WHERE id = p_table_id
            AND NOT EXISTS (
                -- Keep as reserved if other active bookings exist
                SELECT 1 FROM booking_table_assignments bta
                JOIN bookings b ON b.id = bta.booking_id
                WHERE bta.table_id = p_table_id
                    AND b.status NOT IN ('cancelled', 'no_show', 'completed')
            );
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;


--
-- Name: FUNCTION unassign_table_from_booking(p_booking_id uuid, p_table_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.unassign_table_from_booking(p_booking_id uuid, p_table_id uuid) IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';


--
-- Name: unassign_tables_atomic(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unassign_tables_atomic(p_booking_id uuid, p_table_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(table_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_target_tables uuid[] := p_table_ids;
      v_removed RECORD;
    BEGIN
      IF v_target_tables IS NOT NULL THEN
        SELECT array_agg(DISTINCT t.table_id)
        INTO v_target_tables
        FROM unnest(v_target_tables) AS t(table_id);
      ELSE
        SELECT array_agg(bta.table_id)
        INTO v_target_tables
        FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id;
      END IF;

      IF v_target_tables IS NULL OR array_length(v_target_tables, 1) = 0 THEN
        RETURN;
      END IF;

      FOR v_removed IN
        DELETE FROM public.booking_table_assignments bta
        WHERE bta.booking_id = p_booking_id
          AND bta.table_id = ANY (v_target_tables)
        RETURNING bta.table_id
      LOOP
        unassign_tables_atomic.table_id := v_removed.table_id;

        DELETE FROM public.allocations alloc
        WHERE alloc.booking_id = p_booking_id
          AND alloc.resource_type = 'table'
          AND alloc.resource_id = v_removed.table_id;

        UPDATE public.table_inventory ti
        SET status = 'available'::public.table_status
        WHERE ti.id = v_removed.table_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_table_assignments bta2
            WHERE bta2.table_id = v_removed.table_id
          );

        RETURN NEXT;
      END LOOP;

      RETURN;
    END;
    $$;


--
-- Name: update_booking_with_capacity_check(uuid, uuid, uuid, date, time without time zone, time without time zone, integer, text, text, text, text, text, text, boolean, uuid, text, jsonb, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_booking_with_capacity_check(p_booking_id uuid, p_restaurant_id uuid, p_customer_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone, p_party_size integer, p_booking_type text, p_customer_name text, p_customer_email text, p_customer_phone text, p_seating_preference text, p_notes text DEFAULT NULL::text, p_marketing_opt_in boolean DEFAULT false, p_auth_user_id uuid DEFAULT NULL::uuid, p_client_request_id text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb, p_loyalty_points_awarded integer DEFAULT 0, p_source text DEFAULT 'api'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_existing bookings%ROWTYPE;
        v_service_period_id uuid;
        v_service_period_name text;
        v_max_covers integer;
        v_max_parties integer;
        v_booked_covers integer;
        v_booked_parties integer;
        v_timezone_raw text;
        v_timezone text;
        v_start_at timestamptz;
        v_end_at timestamptz;
        v_booking_record jsonb;
        v_booking_type bookings.booking_type%TYPE;
        v_seating_preference bookings.seating_preference%TYPE;
    BEGIN
        SELECT * INTO v_existing
        FROM bookings
        WHERE id = p_booking_id
          AND restaurant_id = p_restaurant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_PARAMS',
                'message', 'Booking not found for update'
            );
        END IF;

        SELECT sp.id, sp.name INTO v_service_period_id, v_service_period_name
        FROM restaurant_service_periods sp
        WHERE sp.restaurant_id = p_restaurant_id
          AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND p_start_time >= sp.start_time
          AND p_start_time < sp.end_time
        ORDER BY
            sp.day_of_week DESC NULLS LAST,
            sp.start_time ASC
        LIMIT 1;

        SELECT
            COALESCE(cr.max_covers, 999999) AS max_covers,
            COALESCE(cr.max_parties, 999999) AS max_parties
        INTO v_max_covers, v_max_parties
        FROM restaurant_capacity_rules cr
        WHERE cr.restaurant_id = p_restaurant_id
          AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_period_id)
          AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM p_booking_date)::smallint)
          AND (cr.effective_date IS NULL OR cr.effective_date <= p_booking_date)
        ORDER BY
            cr.effective_date DESC NULLS LAST,
            cr.day_of_week DESC NULLS LAST,
            cr.service_period_id DESC NULLS LAST
        LIMIT 1
        FOR UPDATE NOWAIT;

        v_max_covers := COALESCE(v_max_covers, 999999);
        v_max_parties := COALESCE(v_max_parties, 999999);

        SELECT
            COALESCE(SUM(b.party_size), 0) AS total_covers,
            COUNT(*) AS total_parties
        INTO v_booked_covers, v_booked_parties
        FROM bookings b
        WHERE b.restaurant_id = p_restaurant_id
          AND b.booking_date = p_booking_date
          AND b.status NOT IN ('cancelled', 'no_show')
          AND b.id <> p_booking_id
          AND (
            v_service_period_id IS NULL
            OR (
                b.start_time >= (SELECT start_time FROM restaurant_service_periods WHERE id = v_service_period_id)
                AND b.start_time < (SELECT end_time FROM restaurant_service_periods WHERE id = v_service_period_id)
            )
          );

        IF v_booked_covers + p_party_size > v_max_covers THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'No capacity available for this time slot',
                'details', jsonb_build_object(
                    'requestedCovers', p_party_size,
                    'maxCovers', v_max_covers,
                    'bookedCovers', v_booked_covers,
                    'availableCovers', GREATEST(v_max_covers - v_booked_covers, 0),
                    'servicePeriod', v_service_period_name,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties
                )
            );
        END IF;

        IF v_booked_parties + 1 > v_max_parties THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CAPACITY_EXCEEDED',
                'message', 'Too many simultaneous parties in this slot',
                'details', jsonb_build_object(
                    'requestedParties', 1,
                    'maxParties', v_max_parties,
                    'bookedParties', v_booked_parties,
                    'servicePeriod', v_service_period_name,
                    'availableParties', GREATEST(v_max_parties - v_booked_parties, 0)
                )
            );
        END IF;

        SELECT timezone INTO v_timezone_raw
        FROM restaurants
        WHERE id = p_restaurant_id;

        v_timezone_raw := COALESCE(BTRIM(v_timezone_raw), '');

        IF v_timezone_raw = '' THEN
            v_timezone := 'Europe/London';
        ELSE
            SELECT name INTO v_timezone
            FROM pg_timezone_names
            WHERE lower(name) = lower(v_timezone_raw)
            LIMIT 1;

            IF NOT FOUND OR v_timezone IS NULL THEN
                v_timezone := 'Europe/London';
            END IF;
        END IF;

        v_start_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_start_time)::int,
            EXTRACT(MINUTE FROM p_start_time)::int,
            EXTRACT(SECOND FROM p_start_time),
            v_timezone
        );

        v_end_at := make_timestamptz(
            EXTRACT(YEAR FROM p_booking_date)::int,
            EXTRACT(MONTH FROM p_booking_date)::int,
            EXTRACT(DAY FROM p_booking_date)::int,
            EXTRACT(HOUR FROM p_end_time)::int,
            EXTRACT(MINUTE FROM p_end_time)::int,
            EXTRACT(SECOND FROM p_end_time),
            v_timezone
        );

        v_booking_type := p_booking_type;
        v_seating_preference := p_seating_preference;

        UPDATE bookings
        SET
            booking_date = p_booking_date,
            start_time = p_start_time,
            end_time = p_end_time,
            start_at = v_start_at,
            end_at = v_end_at,
            party_size = p_party_size,
            booking_type = v_booking_type,
            seating_preference = v_seating_preference,
            customer_name = p_customer_name,
            customer_email = p_customer_email,
            customer_phone = p_customer_phone,
            notes = p_notes,
            marketing_opt_in = p_marketing_opt_in,
            customer_id = p_customer_id,
            auth_user_id = COALESCE(p_auth_user_id, v_existing.auth_user_id),
            client_request_id = COALESCE(p_client_request_id, v_existing.client_request_id),
            loyalty_points_awarded = COALESCE(p_loyalty_points_awarded, v_existing.loyalty_points_awarded),
            source = COALESCE(p_source, v_existing.source),
            details = COALESCE(v_existing.details, '{}'::jsonb)
                || COALESCE(p_details, '{}'::jsonb)
                || jsonb_build_object(
                    'channel', 'api.capacity_safe',
                    'client_request_id', COALESCE(p_client_request_id, v_existing.client_request_id),
                    'capacity_check', jsonb_build_object(
                        'service_period_id', v_service_period_id,
                        'max_covers', v_max_covers,
                        'booked_covers_before', v_booked_covers,
                        'booked_covers_after', v_booked_covers + p_party_size
                    ),
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                )
        WHERE id = p_booking_id
        RETURNING to_jsonb(bookings.*) INTO v_booking_record;

        RETURN jsonb_build_object(
            'success', true,
            'booking', v_booking_record,
            'capacity', jsonb_build_object(
                'servicePeriod', v_service_period_name,
                'maxCovers', v_max_covers,
                'bookedCovers', v_booked_covers + p_party_size,
                'availableCovers', GREATEST(v_max_covers - (v_booked_covers + p_party_size), 0),
                'utilizationPercent', CASE
                    WHEN COALESCE(v_max_covers, 0) = 0 THEN 0
                    ELSE ROUND(((v_booked_covers + p_party_size)::numeric / NULLIF(v_max_covers, 0)) * 100, 1)
                END
            ),
            'message', 'Booking updated successfully'
        );

    EXCEPTION
        WHEN serialization_failure THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Concurrent booking conflict detected. Please retry.',
                'retryable', true
            );
        WHEN deadlock_detected THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Database deadlock detected. Please retry.',
                'retryable', true
            );
        WHEN lock_not_available THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'BOOKING_CONFLICT',
                'message', 'Capacity rule is currently locked by another transaction. Please retry.',
                'retryable', true
            );
        WHEN OTHERS THEN
            RAISE WARNING 'Unexpected error in update_booking_with_capacity_check: % %', SQLERRM, SQLSTATE;
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INTERNAL_ERROR',
                'message', 'An unexpected error occurred while updating the booking',
                'retryable', false,
                'details', jsonb_build_object(
                    'sqlstate', SQLSTATE,
                    'sqlerrm', SQLERRM,
                    'timezone', v_timezone,
                    'original_timezone', NULLIF(v_timezone_raw, '')
                ),
                'sqlstate', SQLSTATE,
                'sqlerrm', SQLERRM,
                'timezone', v_timezone,
                'original_timezone', NULLIF(v_timezone_raw, '')
            );
    END;
    $$;


--
-- Name: update_table_hold_windows(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_table_hold_windows() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.table_hold_windows
  SET
    restaurant_id = NEW.restaurant_id,
    booking_id = NEW.booking_id,
    start_at = NEW.start_at,
    end_at = NEW.end_at,
    expires_at = NEW.expires_at
  WHERE hold_id = NEW.id;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_table_hold_windows(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_table_hold_windows() IS 'Trigger function to update table_hold_windows when hold times change.
Always updates the table to keep conflict detection data consistent.';


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: user_restaurants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_restaurants() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


--
-- Name: user_restaurants_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_restaurants_admin() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
    AND role = ANY (ARRAY['owner'::text, 'manager'::text]);
$$;


--
-- Name: validate_booking_capacity_after_assignment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_booking RECORD;
  v_service_period RECORD;
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_total_covers integer;
  v_total_parties integer;
  v_max_covers integer := 999999;
  v_max_parties integer := 999999;
  v_allow_after_hours boolean := false;
  v_policy RECORD;
  v_service_id uuid;
  v_capacity_table_exists boolean := to_regclass('public.restaurant_capacity_rules') IS NOT NULL;
  v_rule_max_covers integer;
  v_rule_max_parties integer;
BEGIN
  SELECT b.*, r.timezone AS restaurant_timezone
  INTO v_booking
  FROM public.bookings b
  JOIN public.restaurants r ON r.id = b.restaurant_id
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_timezone := COALESCE(NULLIF(v_booking.restaurant_timezone, ''), 'UTC');
  v_start := v_booking.start_at;
  v_end := v_booking.end_at;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;

  SELECT allow_after_hours
  INTO v_allow_after_hours
  FROM public.service_policy
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT sp.*
  INTO v_service_period
  FROM public.restaurant_service_periods sp
  WHERE sp.restaurant_id = v_booking.restaurant_id
    AND (sp.day_of_week IS NULL OR sp.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
    AND v_booking.start_time >= sp.start_time
    AND v_booking.start_time < sp.end_time
  ORDER BY sp.day_of_week DESC NULLS LAST, sp.start_time ASC
  LIMIT 1;

  v_service_id := v_service_period.id;

  IF v_capacity_table_exists THEN
    SELECT
      COALESCE(cr.max_covers, v_max_covers),
      COALESCE(cr.max_parties, v_max_parties)
    INTO v_rule_max_covers, v_rule_max_parties
    FROM public.restaurant_capacity_rules cr
    WHERE cr.restaurant_id = v_booking.restaurant_id
      AND (cr.service_period_id IS NULL OR cr.service_period_id = v_service_id)
      AND (cr.day_of_week IS NULL OR cr.day_of_week = EXTRACT(DOW FROM v_booking.booking_date)::smallint)
      AND (cr.effective_date IS NULL OR cr.effective_date <= v_booking.booking_date)
    ORDER BY cr.effective_date DESC NULLS LAST,
             cr.day_of_week DESC NULLS LAST,
             cr.service_period_id DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    v_max_covers := COALESCE(v_rule_max_covers, v_max_covers);
    v_max_parties := COALESCE(v_rule_max_parties, v_max_parties);
  ELSE
    RAISE LOG 'Skipping capacity overrides for booking %, restaurant % because public.restaurant_capacity_rules is absent.',
      p_booking_id,
      v_booking.restaurant_id;
  END IF;

  SELECT
    COALESCE(SUM(b.party_size), 0) AS total_covers,
    COUNT(*) AS total_parties
  INTO v_total_covers, v_total_parties
  FROM public.bookings b
  WHERE b.restaurant_id = v_booking.restaurant_id
    AND b.booking_date = v_booking.booking_date
    AND b.status IN ('confirmed', 'pending', 'checked_in')
    AND (
      v_service_id IS NULL
      OR (b.start_time >= v_service_period.start_time AND b.start_time < v_service_period.end_time)
    );

  IF v_total_covers > v_max_covers OR v_total_parties > v_max_parties THEN
    RAISE EXCEPTION 'capacity_exceeded_post_assignment'
      USING ERRCODE = 'P0001',
            DETAIL = format('Capacity exceeded after assignment: covers %s/%s, parties %s/%s', v_total_covers, v_max_covers, v_total_parties, v_max_parties),
            HINT = 'Release tables or adjust capacity overrides before retrying.';
  END IF;
END;
$$;


--
-- Name: FUNCTION validate_booking_capacity_after_assignment(p_booking_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_booking_capacity_after_assignment(p_booking_id uuid) IS 'Checks post-assignment capacity; tolerates missing restaurant_capacity_rules via to_regclass guard.';


--
-- Name: validate_booking_has_assignments(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_booking_has_assignments() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only validate when status is being changed to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Check if this booking has any table assignments
    IF NOT EXISTS (
      SELECT 1 
      FROM booking_table_assignments 
      WHERE booking_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot confirm booking %: No table assignments exist. Booking must have at least one table assigned before confirmation.', NEW.id
        USING HINT = 'Use the assign_tables RPC function to assign tables before confirming';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION validate_booking_has_assignments(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_booking_has_assignments() IS 'Validates that confirmed bookings have at least one table assignment. Prevents orphaned confirmations.';


--
-- Name: validate_table_adjacency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_table_adjacency() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  zone_a uuid;
  zone_b uuid;
BEGIN
  SELECT zone_id INTO zone_a FROM public.table_inventory WHERE id = NEW.table_a;
  SELECT zone_id INTO zone_b FROM public.table_inventory WHERE id = NEW.table_b;

  IF zone_a IS NULL OR zone_b IS NULL THEN
    RAISE EXCEPTION 'Tables must belong to zones before adjacency can be created';
  END IF;

  IF zone_a <> zone_b THEN
    RAISE EXCEPTION 'Adjacency requires tables to be in the same zone';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migrations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'applied'::character varying
);


--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public._migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shadow boolean DEFAULT false NOT NULL,
    restaurant_id uuid NOT NULL,
    "window" tstzrange NOT NULL,
    created_by uuid,
    is_maintenance boolean DEFAULT false NOT NULL,
    CONSTRAINT allocations_resource_type_check CHECK ((resource_type = ANY (ARRAY['table'::text, 'hold'::text, 'merge_group'::text])))
);


--
-- Name: COLUMN allocations.shadow; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.shadow IS 'True when allocation is tentative (shadow). Shadow allocations are visible to staff but do not block standard bookings.';


--
-- Name: COLUMN allocations.is_maintenance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.allocations.is_maintenance IS 'True when allocation reserves a table for maintenance/out-of-service windows rather than a booking.';


--
-- Name: allowed_capacities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allowed_capacities (
    restaurant_id uuid NOT NULL,
    capacity smallint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT allowed_capacities_capacity_check CHECK ((capacity > 0))
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    event_type public.analytics_event_type NOT NULL,
    schema_version text NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    customer_id uuid,
    emitted_by text DEFAULT 'server'::text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE analytics_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.analytics_events IS 'Tracks booking-related analytics events for reporting and metrics.';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_assignment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    strategy text NOT NULL,
    result text NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: booking_assignment_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_idempotency (
    booking_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    table_ids uuid[] NOT NULL,
    assignment_window tstzrange NOT NULL,
    merge_group_allocation_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    table_set_hash text
);


--
-- Name: TABLE booking_assignment_idempotency; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_assignment_idempotency IS 'Tracks idempotent table assignments to prevent duplicate allocations.';


--
-- Name: COLUMN booking_assignment_idempotency.table_set_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_assignment_idempotency.table_set_hash IS 'MD5 hash of sorted table ids used to dedupe idempotency payloads.';


--
-- Name: booking_assignment_state_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_assignment_state_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    from_state public.booking_assignment_state,
    to_state public.booking_assignment_state NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: booking_occasions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_occasions (
    key text NOT NULL,
    label text NOT NULL,
    short_label text NOT NULL,
    description text,
    availability jsonb DEFAULT '[]'::jsonb NOT NULL,
    default_duration_minutes smallint DEFAULT 90 NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_builtin boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT booking_occasions_builtin_not_deleted CHECK ((NOT (is_builtin AND (deleted_at IS NOT NULL))))
);


--
-- Name: booking_occasions_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_occasions_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occasion_key text NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT booking_occasions_audit_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    slot_date date NOT NULL,
    slot_time time without time zone NOT NULL,
    service_period_id uuid,
    available_capacity integer DEFAULT 0 NOT NULL,
    reserved_count integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_slots_available_capacity_positive CHECK ((available_capacity >= 0)),
    CONSTRAINT booking_slots_capacity_valid CHECK (((reserved_count >= 0) AND (reserved_count <= available_capacity)))
);


--
-- Name: TABLE booking_slots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_slots IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';


--
-- Name: COLUMN booking_slots.slot_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_date IS 'Date of the slot (e.g., 2025-10-20)';


--
-- Name: COLUMN booking_slots.slot_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.slot_time IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';


--
-- Name: COLUMN booking_slots.service_period_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.service_period_id IS 'Optional link to service period (lunch/dinner). Null if not applicable.';


--
-- Name: COLUMN booking_slots.available_capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.available_capacity IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';


--
-- Name: COLUMN booking_slots.reserved_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.reserved_count IS 'Number of covers/guests currently reserved for this slot.';


--
-- Name: COLUMN booking_slots.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_slots.version IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';


--
-- Name: booking_state_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_state_history (
    id bigint NOT NULL,
    booking_id uuid NOT NULL,
    from_status public.booking_status,
    to_status public.booking_status NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE booking_state_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_state_history IS 'Audit history of booking lifecycle transitions.';


--
-- Name: COLUMN booking_state_history.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.booking_id IS 'Booking whose status transitioned.';


--
-- Name: COLUMN booking_state_history.from_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.from_status IS 'Previous lifecycle status.';


--
-- Name: COLUMN booking_state_history.to_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.to_status IS 'New lifecycle status.';


--
-- Name: COLUMN booking_state_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_by IS 'User who triggered the change (null for system operations).';


--
-- Name: COLUMN booking_state_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.changed_at IS 'UTC timestamp when the transition was recorded.';


--
-- Name: COLUMN booking_state_history.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.reason IS 'Optional human-readable reason for the transition.';


--
-- Name: COLUMN booking_state_history.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_state_history.metadata IS 'Additional structured data describing the transition.';


--
-- Name: booking_state_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_state_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_state_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_state_history_id_seq OWNED BY public.booking_state_history.id;


--
-- Name: booking_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_versions (
    version_id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    booking_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    change_type public.booking_change_type NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE booking_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.booking_versions IS 'Audit trail for booking changes with before/after snapshots.';


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    booking_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    status public.booking_status DEFAULT 'confirmed'::public.booking_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    notes text,
    reference text NOT NULL,
    source text DEFAULT 'web'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_type text DEFAULT 'dinner'::text NOT NULL,
    idempotency_key text,
    client_request_id text DEFAULT (gen_random_uuid())::text NOT NULL,
    pending_ref text,
    details jsonb,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    confirmation_token character varying(64),
    confirmation_token_expires_at timestamp with time zone,
    confirmation_token_used_at timestamp with time zone,
    auth_user_id uuid,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    loyalty_points_awarded integer DEFAULT 0 NOT NULL,
    table_id uuid,
    assigned_zone_id uuid,
    auto_assign_idempotency_key text,
    auto_assign_last_result jsonb,
    assignment_state_version integer DEFAULT 1 NOT NULL,
    assignment_strategy text,
    assignment_state public.booking_assignment_state DEFAULT 'created'::public.booking_assignment_state NOT NULL,
    last_auto_assign_job_result jsonb,
    CONSTRAINT bookings_checked_out_after_checked_in CHECK (((checked_out_at IS NULL) OR (checked_in_at IS NULL) OR (checked_out_at >= checked_in_at))),
    CONSTRAINT bookings_lifecycle_timestamp_consistency CHECK ((((status = ANY (ARRAY['pending'::public.booking_status, 'pending_allocation'::public.booking_status, 'confirmed'::public.booking_status])) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)) OR ((status = 'checked_in'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NULL)) OR ((status = 'completed'::public.booking_status) AND (checked_in_at IS NOT NULL) AND (checked_out_at IS NOT NULL) AND (checked_out_at >= checked_in_at)) OR (status = 'cancelled'::public.booking_status) OR ((status = 'no_show'::public.booking_status) AND (checked_in_at IS NULL) AND (checked_out_at IS NULL)))),
    CONSTRAINT bookings_party_size_check CHECK ((party_size > 0)),
    CONSTRAINT chk_time_order CHECK ((start_at < end_at))
);


--
-- Name: TABLE bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bookings IS 'Customer reservations with party size, time, and status';


--
-- Name: COLUMN bookings.pending_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.pending_ref IS 'Temporary reference used while an asynchronous booking is pending confirmation. Should be NULL for finalized bookings.';


--
-- Name: COLUMN bookings.confirmation_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token IS 'One-time cryptographic token (base64url, 64 chars) for guest confirmation page access. Expires in 1 hour.';


--
-- Name: COLUMN bookings.confirmation_token_expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_expires_at IS 'Expiry timestamp for confirmation_token. After this time, token is invalid.';


--
-- Name: COLUMN bookings.confirmation_token_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.confirmation_token_used_at IS 'Timestamp when confirmation_token was first used. Prevents token replay attacks.';


--
-- Name: COLUMN bookings.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.auth_user_id IS 'Optional link to the authenticated Supabase user that created or owns the booking.';


--
-- Name: COLUMN bookings.checked_in_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_in_at IS 'Timestamp when the guest was checked in by ops';


--
-- Name: COLUMN bookings.checked_out_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.checked_out_at IS 'Timestamp when the guest was checked out by ops';


--
-- Name: COLUMN bookings.assigned_zone_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.assigned_zone_id IS 'Zone enforced for all table assignments tied to the booking.';


--
-- Name: CONSTRAINT bookings_checked_out_after_checked_in ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_checked_out_after_checked_in ON public.bookings IS 'Ensures recorded check-out timestamps are chronologically after check-in.';


--
-- Name: CONSTRAINT bookings_lifecycle_timestamp_consistency ON bookings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT bookings_lifecycle_timestamp_consistency ON public.bookings IS 'Ensures booking lifecycle timestamps align with the status (checked-in bookings must have check-in timestamps, completed bookings need both timestamps, etc).';


--
-- Name: capacity_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capacity_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    event_type text NOT NULL,
    dedupe_key text,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    restaurant_id uuid,
    booking_id uuid,
    idempotency_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT capacity_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'dead'::text])))
);


--
-- Name: TABLE capacity_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.capacity_outbox IS 'Outbox for reliable post-commit processing (sync, telemetry).';


--
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profiles (
    customer_id uuid NOT NULL,
    first_booking_at timestamp with time zone,
    last_booking_at timestamp with time zone,
    total_bookings integer DEFAULT 0 NOT NULL,
    total_covers integer DEFAULT 0 NOT NULL,
    total_cancellations integer DEFAULT 0 NOT NULL,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    last_marketing_opt_in_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_profiles_total_bookings_check CHECK ((total_bookings >= 0)),
    CONSTRAINT customer_profiles_total_cancellations_check CHECK ((total_cancellations >= 0)),
    CONSTRAINT customer_profiles_total_covers_check CHECK ((total_covers >= 0))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]+'::text, ''::text, 'g'::text)) STORED,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    auth_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_profile_id uuid,
    CONSTRAINT customers_email_check CHECK ((email = lower(email))),
    CONSTRAINT customers_phone_check CHECK (((length(phone) >= 7) AND (length(phone) <= 20)))
);


--
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customers IS 'Guest profiles with contact details';


--
-- Name: COLUMN customers.user_profile_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.user_profile_id IS 'Optional foreign key to global user_profiles identity.';


--
-- Name: demand_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demand_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    service_window text NOT NULL,
    multiplier numeric(3,2) DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_minute integer,
    end_minute integer,
    priority integer DEFAULT 1,
    label text,
    CONSTRAINT demand_profiles_check CHECK (((end_minute IS NULL) OR ((end_minute > start_minute) AND (end_minute <= 1440)))),
    CONSTRAINT demand_profiles_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT demand_profiles_multiplier_check CHECK (((multiplier >= 0.1) AND (multiplier <= 10.0))),
    CONSTRAINT demand_profiles_priority_check CHECK ((priority >= 1)),
    CONSTRAINT demand_profiles_start_minute_check CHECK (((start_minute IS NULL) OR ((start_minute >= 0) AND (start_minute < 1440))))
);


--
-- Name: TABLE demand_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.demand_profiles IS 'Configures dynamic pricing multipliers by day of week and service window.';


--
-- Name: feature_flag_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flag_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag text NOT NULL,
    environment text NOT NULL,
    value boolean NOT NULL,
    notes jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid
);


--
-- Name: TABLE feature_flag_overrides; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feature_flag_overrides IS 'Runtime feature flag overrides per environment.';


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE leads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.leads IS 'Marketing email leads for newsletter signups.';


--
-- Name: merge_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.merge_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_a smallint NOT NULL,
    from_b smallint NOT NULL,
    to_capacity smallint NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    require_same_zone boolean DEFAULT true NOT NULL,
    require_adjacency boolean DEFAULT true NOT NULL,
    cross_category_merge boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT merge_rules_positive CHECK (((from_a > 0) AND (from_b > 0) AND (to_capacity > 0)))
);


--
-- Name: observability_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observability_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    context jsonb,
    restaurant_id uuid,
    booking_id uuid,
    CONSTRAINT observability_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])))
);


--
-- Name: profile_update_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_update_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    applied_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    name text,
    phone text,
    image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    has_access boolean DEFAULT true NOT NULL,
    CONSTRAINT profiles_email_check CHECK ((email = lower(email)))
);


--
-- Name: COLUMN profiles.has_access; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.has_access IS 'Indicates whether the profile retains active access to Ops surfaces.';


--
-- Name: restaurant_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    email text NOT NULL,
    email_normalized text GENERATED ALWAYS AS (lower(TRIM(BOTH FROM email))) STORED,
    role text NOT NULL,
    token_hash text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT restaurant_invites_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text]))),
    CONSTRAINT restaurant_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text, 'expired'::text])))
);


--
-- Name: restaurant_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_memberships (
    user_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'host'::text, 'server'::text])))
);


--
-- Name: restaurant_operating_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_operating_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    day_of_week smallint,
    effective_date date,
    opens_at time without time zone,
    closes_at time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restaurant_operating_hours_scope CHECK (((day_of_week IS NOT NULL) OR (effective_date IS NOT NULL))),
    CONSTRAINT restaurant_operating_hours_time_order CHECK ((is_closed OR ((opens_at IS NOT NULL) AND (closes_at IS NOT NULL) AND (opens_at < closes_at))))
);


--
-- Name: restaurant_service_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_service_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    day_of_week smallint,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_option text DEFAULT 'drinks'::text NOT NULL,
    CONSTRAINT restaurant_service_periods_time_order CHECK ((start_time < end_time))
);


--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text DEFAULT 'Europe/London'::text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_email text,
    contact_phone text,
    address text,
    booking_policy text,
    reservation_interval_minutes integer DEFAULT 15 NOT NULL,
    reservation_default_duration_minutes integer DEFAULT 90 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    reservation_last_seating_buffer_minutes integer DEFAULT 120 NOT NULL,
    logo_url text,
    email_send_reminder_24h boolean DEFAULT true NOT NULL,
    email_send_reminder_short boolean DEFAULT true NOT NULL,
    email_send_review_request boolean DEFAULT true NOT NULL,
    google_map_url text,
    CONSTRAINT restaurants_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT restaurants_reservation_default_duration_minutes_check CHECK (((reservation_default_duration_minutes >= 15) AND (reservation_default_duration_minutes <= 300))),
    CONSTRAINT restaurants_reservation_interval_minutes_check CHECK (((reservation_interval_minutes > 0) AND (reservation_interval_minutes <= 180))),
    CONSTRAINT restaurants_reservation_last_seating_buffer_minutes_check CHECK (((reservation_last_seating_buffer_minutes >= 15) AND (reservation_last_seating_buffer_minutes <= 300))),
    CONSTRAINT restaurants_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: TABLE restaurants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.restaurants IS 'Restaurant entities with timezone and capacity configuration';


--
-- Name: COLUMN restaurants.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.timezone IS 'Timezone of the restaurant (e.g., ''America/New_York''). Non-nullable, defaults to ''Europe/London''.';


--
-- Name: COLUMN restaurants.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.is_active IS 'Indicates whether the restaurant is active and should surface in public experiences.';


--
-- Name: COLUMN restaurants.reservation_last_seating_buffer_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.reservation_last_seating_buffer_minutes IS 'Minimum minutes before closing when the final reservation may start.';


--
-- Name: COLUMN restaurants.logo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.restaurants.logo_url IS 'Publicly accessible logo URL used in outbound communications.';


--
-- Name: service_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lunch_start time without time zone DEFAULT '12:00:00'::time without time zone NOT NULL,
    lunch_end time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    dinner_start time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    dinner_end time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    clean_buffer_minutes smallint DEFAULT 5 NOT NULL,
    allow_after_hours boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN service_policy.allow_after_hours; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_policy.allow_after_hours IS 'If true, privileged staff may override standard operating hours when creating bookings.';


--
-- Name: strategic_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    config_key text NOT NULL,
    config_value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE strategic_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.strategic_configs IS 'Restaurant-specific strategic planner configuration.';


--
-- Name: table_adjacencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_adjacencies (
    table_a uuid NOT NULL,
    table_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_adjacencies_not_equal CHECK ((table_a <> table_b))
);


--
-- Name: table_hold_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_hold_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: TABLE table_hold_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_hold_members IS 'Junction table linking table holds to specific tables.';


--
-- Name: table_hold_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_hold_windows (
    hold_id uuid NOT NULL,
    table_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    hold_window tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED
);


--
-- Name: TABLE table_hold_windows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_hold_windows IS 'Denormalized view for fast conflict detection on table holds.';


--
-- Name: table_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_id uuid,
    zone_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb,
    session_id uuid,
    status public.table_hold_status DEFAULT 'active'::public.table_hold_status NOT NULL,
    last_touched_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT table_holds_time_order_check CHECK (((start_at < end_at) AND (expires_at >= end_at))),
    CONSTRAINT table_holds_window_check CHECK ((start_at < end_at)),
    CONSTRAINT th_times_consistent CHECK ((expires_at >= end_at))
);


--
-- Name: TABLE table_holds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_holds IS 'Ephemeral table reservations to guard allocations during quoting/confirmation flows.';


--
-- Name: table_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_number text NOT NULL,
    capacity integer NOT NULL,
    section text,
    status public.table_status DEFAULT 'available'::public.table_status NOT NULL,
    "position" jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid NOT NULL,
    category public.table_category NOT NULL,
    seating_type public.table_seating_type DEFAULT 'standard'::public.table_seating_type NOT NULL,
    mobility public.table_mobility DEFAULT 'movable'::public.table_mobility NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE table_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_inventory IS 'Physical table inventory. Party size rules are derived from mobility and capacity in application code.';


--
-- Name: COLUMN table_inventory.table_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.table_number IS 'Display name for the table (e.g., "T1", "Main-5", "Patio-2")';


--
-- Name: COLUMN table_inventory.capacity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.capacity IS 'Physical property: number of seats. For fixed tables, this is also the max party size.';


--
-- Name: COLUMN table_inventory.section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.section IS 'Section name (e.g., "Main Floor", "Patio", "Bar Area", "Private Room")';


--
-- Name: COLUMN table_inventory.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.status IS 'Current status: available, reserved, occupied, out_of_service';


--
-- Name: COLUMN table_inventory."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory."position" IS 'Floor plan position as JSON: {x: number, y: number, rotation?: number} for drag-and-drop UI';


--
-- Name: COLUMN table_inventory.mobility; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.table_inventory.mobility IS 'Physical property: whether table can be moved. Business rules are derived from this:
  - movable: can be merged with other tables (unlimited party size when combined)
  - fixed: cannot be merged (strict party size = capacity)';


--
-- Name: table_scarcity_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.table_scarcity_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_type text NOT NULL,
    scarcity_score numeric(5,4) NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT table_scarcity_metrics_scarcity_score_check CHECK (((scarcity_score >= (0)::numeric) AND (scarcity_score <= (1)::numeric)))
);


--
-- Name: TABLE table_scarcity_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.table_scarcity_metrics IS 'Pre-computed scarcity scores for table types to optimize assignment.';


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    name text,
    email public.citext,
    phone text,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_profiles_phone_e164_check CHECK (((phone IS NULL) OR (phone ~ '^\+[1-9]\d{1,14}$'::text)))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'Global customer identity (1:1 with auth.users).';


--
-- Name: COLUMN user_profiles.phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number stored in E.164 format (leading + and digits only).';


--
-- Name: waiting_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waiting_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    booking_date date NOT NULL,
    desired_time time without time zone NOT NULL,
    party_size integer NOT NULL,
    seating_preference public.seating_preference_type DEFAULT 'any'::public.seating_preference_type NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waiting_list_party_size_check CHECK ((party_size > 0))
);


--
-- Name: TABLE waiting_list; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.waiting_list IS 'Customers waiting for availability on fully booked dates/times.';


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    area_type public.area_type DEFAULT 'indoor'::public.area_type NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT zones_name_not_blank CHECK ((char_length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: TABLE zones; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.zones IS 'Dining zones within restaurants (e.g., Dining 1, Dining 2)';


--
-- Name: COLUMN zones.active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.zones.active IS 'Indicates whether the zone is currently in service';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: booking_state_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history ALTER COLUMN id SET DEFAULT nextval('public.booking_state_history_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_booking_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_resource_key UNIQUE (booking_id, resource_type, resource_id);


--
-- Name: allocations allocations_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_no_overlap EXCLUDE USING gist (restaurant_id WITH =, resource_type WITH =, resource_id WITH =, "window" WITH &&) WHERE ((NOT shadow)) DEFERRABLE;


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: allowed_capacities allowed_capacities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_pkey PRIMARY KEY (restaurant_id, capacity);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_assignment_attempts booking_assignment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_attempts
    ADD CONSTRAINT booking_assignment_attempts_pkey PRIMARY KEY (id);


--
-- Name: booking_assignment_idempotency booking_assignment_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_pkey PRIMARY KEY (booking_id, idempotency_key);


--
-- Name: booking_assignment_state_history booking_assignment_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_state_history
    ADD CONSTRAINT booking_assignment_state_history_pkey PRIMARY KEY (id);


--
-- Name: booking_occasions_audit booking_occasions_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_occasions_audit
    ADD CONSTRAINT booking_occasions_audit_pkey PRIMARY KEY (id);


--
-- Name: booking_occasions booking_occasions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_occasions
    ADD CONSTRAINT booking_occasions_pkey PRIMARY KEY (key);


--
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);


--
-- Name: booking_slots booking_slots_restaurant_slot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_slot_key UNIQUE (restaurant_id, slot_date, slot_time);


--
-- Name: booking_state_history booking_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_pkey PRIMARY KEY (id);


--
-- Name: booking_table_assignments booking_table_assignments_booking_table_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_table_key UNIQUE (booking_id, table_id);


--
-- Name: booking_table_assignments booking_table_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_pkey PRIMARY KEY (id);


--
-- Name: booking_table_assignments booking_table_assignments_table_id_slot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_slot_id_key UNIQUE (table_id, slot_id);


--
-- Name: booking_versions booking_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_pkey PRIMARY KEY (version_id);


--
-- Name: bookings bookings_confirmation_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_confirmation_token_unique UNIQUE (confirmation_token);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_reference_key UNIQUE (reference);


--
-- Name: booking_table_assignments bta_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT bta_no_overlap EXCLUDE USING gist (table_id WITH =, assignment_window WITH &&) WHERE ((table_id IS NOT NULL));


--
-- Name: capacity_outbox capacity_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capacity_outbox
    ADD CONSTRAINT capacity_outbox_pkey PRIMARY KEY (id);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_restaurant_email_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_email_phone_key UNIQUE (restaurant_id, email_normalized, phone_normalized);


--
-- Name: customers customers_restaurant_id_email_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_email_normalized_key UNIQUE (restaurant_id, email_normalized);


--
-- Name: customers customers_restaurant_id_phone_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_phone_normalized_key UNIQUE (restaurant_id, phone_normalized);


--
-- Name: demand_profiles demand_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_overrides feature_flag_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_pkey PRIMARY KEY (id);


--
-- Name: feature_flag_overrides feature_flag_overrides_unique_flag_env; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_overrides
    ADD CONSTRAINT feature_flag_overrides_unique_flag_env UNIQUE (flag, environment);


--
-- Name: leads leads_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_email_key UNIQUE (email);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: merge_rules merge_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.merge_rules
    ADD CONSTRAINT merge_rules_pkey PRIMARY KEY (id);


--
-- Name: booking_table_assignments no_overlapping_table_assignments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT no_overlapping_table_assignments EXCLUDE USING gist (table_id WITH =, tstzrange(start_at, end_at, '[)'::text) WITH &&) WHERE (((start_at IS NOT NULL) AND (end_at IS NOT NULL)));


--
-- Name: observability_events observability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_pkey PRIMARY KEY (id);


--
-- Name: profile_update_requests profile_update_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: restaurant_invites restaurant_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_pkey PRIMARY KEY (id);


--
-- Name: restaurant_memberships restaurant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_pkey PRIMARY KEY (user_id, restaurant_id);


--
-- Name: restaurant_operating_hours restaurant_operating_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_pkey PRIMARY KEY (id);


--
-- Name: restaurant_service_periods restaurant_service_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);


--
-- Name: service_policy service_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_policy
    ADD CONSTRAINT service_policy_pkey PRIMARY KEY (id);


--
-- Name: strategic_configs strategic_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_pkey PRIMARY KEY (id);


--
-- Name: strategic_configs strategic_configs_restaurant_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_key_unique UNIQUE (restaurant_id, config_key);


--
-- Name: table_adjacencies table_adjacencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_pkey PRIMARY KEY (table_a, table_b);


--
-- Name: table_hold_members table_hold_members_hold_id_table_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_table_id_key UNIQUE (hold_id, table_id);


--
-- Name: table_hold_members table_hold_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_pkey PRIMARY KEY (id);


--
-- Name: table_hold_windows table_hold_windows_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_no_overlap EXCLUDE USING gist (table_id WITH =, hold_window WITH &&);


--
-- Name: table_hold_windows table_hold_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_pkey PRIMARY KEY (hold_id, table_id);


--
-- Name: table_holds table_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_pkey PRIMARY KEY (id);


--
-- Name: table_inventory table_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_pkey PRIMARY KEY (id);


--
-- Name: table_inventory table_inventory_restaurant_id_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_table_number_key UNIQUE (restaurant_id, table_number);


--
-- Name: table_scarcity_metrics table_scarcity_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_pkey PRIMARY KEY (id);


--
-- Name: table_scarcity_metrics unique_restaurant_table_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT unique_restaurant_table_type UNIQUE (restaurant_id, table_type);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: waiting_list waiting_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_list
    ADD CONSTRAINT waiting_list_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: allocations_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_booking_id_idx ON public.allocations USING btree (booking_id);


--
-- Name: allocations_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_resource_idx ON public.allocations USING btree (resource_type, resource_id);


--
-- Name: allocations_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_restaurant_id_idx ON public.allocations USING btree (restaurant_id);


--
-- Name: allocations_window_gist_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_window_gist_idx ON public.allocations USING gist ("window");


--
-- Name: allowed_capacities_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allowed_capacities_restaurant_idx ON public.allowed_capacities USING btree (restaurant_id, capacity);


--
-- Name: booking_assignment_attempts_booking_attempt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_assignment_attempts_booking_attempt_idx ON public.booking_assignment_attempts USING btree (booking_id, attempt_no);


--
-- Name: booking_assignment_attempts_booking_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_attempts_booking_created_idx ON public.booking_assignment_attempts USING btree (booking_id, created_at DESC);


--
-- Name: booking_assignment_state_history_booking_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_assignment_state_history_booking_created_idx ON public.booking_assignment_state_history USING btree (booking_id, created_at DESC);


--
-- Name: booking_occasions_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_active_idx ON public.booking_occasions USING btree (is_active, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: booking_occasions_audit_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_audit_key_idx ON public.booking_occasions_audit USING btree (occasion_key, changed_at DESC);


--
-- Name: booking_occasions_display_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_occasions_display_order_idx ON public.booking_occasions USING btree (display_order);


--
-- Name: booking_slots_available_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_slots_available_idx ON public.booking_slots USING btree (restaurant_id, slot_date, slot_time) WHERE (available_capacity > 0);


--
-- Name: booking_table_assignments_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_booking_id_idx ON public.booking_table_assignments USING btree (booking_id);


--
-- Name: booking_table_assignments_merge_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_merge_group_idx ON public.booking_table_assignments USING btree (merge_group_id);


--
-- Name: booking_table_assignments_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_slot_id_idx ON public.booking_table_assignments USING btree (slot_id);


--
-- Name: booking_table_assignments_table_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_table_assignments_table_id_idx ON public.booking_table_assignments USING btree (table_id);


--
-- Name: bookings_booking_date_start_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_booking_date_start_time_idx ON public.bookings USING btree (restaurant_id, booking_date, start_time);


--
-- Name: bookings_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_customer_id_idx ON public.bookings USING btree (customer_id);


--
-- Name: bookings_restaurant_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_idx ON public.bookings USING btree (restaurant_id, booking_date, start_at);


--
-- Name: bookings_restaurant_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_date_status_idx ON public.bookings USING btree (restaurant_id, booking_date, status);


--
-- Name: bookings_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_restaurant_id_idx ON public.bookings USING btree (restaurant_id);


--
-- Name: bta_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_booking_id_idx ON public.booking_table_assignments USING btree (booking_id);


--
-- Name: bta_table_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_table_id_idx ON public.booking_table_assignments USING btree (table_id);


--
-- Name: bta_table_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_table_window_gist ON public.booking_table_assignments USING gist (table_id, assignment_window);


--
-- Name: bta_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bta_window_gist ON public.booking_table_assignments USING gist (assignment_window);


--
-- Name: capacity_outbox_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_booking_idx ON public.capacity_outbox USING btree (booking_id);


--
-- Name: capacity_outbox_dedupe_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX capacity_outbox_dedupe_unique ON public.capacity_outbox USING btree (event_type, COALESCE(dedupe_key, ''::text), COALESCE(idempotency_key, ''::text)) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));


--
-- Name: capacity_outbox_dispatch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_dispatch_idx ON public.capacity_outbox USING btree (status, next_attempt_at);


--
-- Name: capacity_outbox_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX capacity_outbox_restaurant_idx ON public.capacity_outbox USING btree (restaurant_id);


--
-- Name: customers_email_normalized_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_email_normalized_uniq ON public.customers USING btree (restaurant_id, email_normalized) WHERE (email_normalized IS NOT NULL);


--
-- Name: customers_phone_normalized_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_phone_normalized_uniq ON public.customers USING btree (restaurant_id, phone_normalized) WHERE (phone_normalized IS NOT NULL);


--
-- Name: customers_restaurant_id_user_profile_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_restaurant_id_user_profile_id_unique ON public.customers USING btree (restaurant_id, user_profile_id) WHERE (user_profile_id IS NOT NULL);


--
-- Name: idx_allocations_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_restaurant ON public.allocations USING btree (restaurant_id);


--
-- Name: idx_allocations_window_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_window_gist ON public.allocations USING gist ("window");


--
-- Name: idx_analytics_events_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_booking_id ON public.analytics_events USING btree (booking_id);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);


--
-- Name: idx_analytics_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_occurred_at ON public.analytics_events USING btree (occurred_at);


--
-- Name: idx_analytics_events_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_restaurant_id ON public.analytics_events USING btree (restaurant_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_booking_assignment_idempotency_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_assignment_idempotency_booking ON public.booking_assignment_idempotency USING btree (booking_id);


--
-- Name: idx_booking_assignment_idempotency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_assignment_idempotency_created ON public.booking_assignment_idempotency USING btree (created_at);


--
-- Name: idx_booking_slots_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_date_range ON public.booking_slots USING btree (restaurant_id, slot_date);


--
-- Name: INDEX idx_booking_slots_date_range; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_date_range IS 'Fast queries for all slots on a given date';


--
-- Name: idx_booking_slots_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_lookup ON public.booking_slots USING btree (restaurant_id, slot_date, slot_time);


--
-- Name: INDEX idx_booking_slots_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_lookup IS 'Fast lookup for specific slot (primary use case)';


--
-- Name: idx_booking_slots_service_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_service_period ON public.booking_slots USING btree (service_period_id, slot_date);


--
-- Name: INDEX idx_booking_slots_service_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_slots_service_period IS 'Fast queries by service period (e.g., all lunch slots)';


--
-- Name: idx_booking_state_history_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_booking ON public.booking_state_history USING btree (booking_id, changed_at DESC);


--
-- Name: INDEX idx_booking_state_history_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_booking IS 'Lookup transitions for a booking ordered by recency.';


--
-- Name: idx_booking_state_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_state_history_changed_at ON public.booking_state_history USING btree (changed_at);


--
-- Name: INDEX idx_booking_state_history_changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_state_history_changed_at IS 'Support chronological reporting of booking transitions.';


--
-- Name: idx_booking_table_assignments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_booking ON public.booking_table_assignments USING btree (booking_id);


--
-- Name: INDEX idx_booking_table_assignments_booking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_booking IS 'Fast lookup of tables assigned to a booking';


--
-- Name: idx_booking_table_assignments_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_booking_id ON public.booking_table_assignments USING btree (booking_id);


--
-- Name: INDEX idx_booking_table_assignments_booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_booking_id IS 'Improves performance of booking assignment validation trigger';


--
-- Name: idx_booking_table_assignments_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_slot ON public.booking_table_assignments USING btree (slot_id);


--
-- Name: INDEX idx_booking_table_assignments_slot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_slot IS 'Fast lookup of assignments per slot';


--
-- Name: idx_booking_table_assignments_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_table_assignments_table ON public.booking_table_assignments USING btree (table_id, assigned_at);


--
-- Name: INDEX idx_booking_table_assignments_table; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_booking_table_assignments_table IS 'Fast lookup of bookings using a table (for reservation timeline)';


--
-- Name: idx_booking_versions_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_booking_id ON public.booking_versions USING btree (booking_id);


--
-- Name: idx_booking_versions_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_changed_at ON public.booking_versions USING btree (changed_at);


--
-- Name: idx_booking_versions_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_versions_restaurant_id ON public.booking_versions USING btree (restaurant_id);


--
-- Name: idx_bookings_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auth_user ON public.bookings USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_bookings_auto_assign_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_auto_assign_idempotency_key ON public.bookings USING btree (auto_assign_idempotency_key) WHERE (auto_assign_idempotency_key IS NOT NULL);


--
-- Name: idx_bookings_client_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_client_request_id ON public.bookings USING btree (client_request_id);


--
-- Name: idx_bookings_confirmation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_confirmation_token ON public.bookings USING btree (confirmation_token) WHERE (confirmation_token IS NOT NULL);


--
-- Name: idx_bookings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_created ON public.bookings USING btree (restaurant_id, created_at DESC);


--
-- Name: idx_bookings_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_customer ON public.bookings USING btree (customer_id);


--
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (restaurant_id, booking_date);


--
-- Name: idx_bookings_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_datetime ON public.bookings USING btree (restaurant_id, start_at, end_at);


--
-- Name: idx_bookings_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_idempotency_key ON public.bookings USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_bookings_pending_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pending_ref ON public.bookings USING btree (pending_ref) WHERE (pending_ref IS NOT NULL);


--
-- Name: idx_bookings_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_reference ON public.bookings USING btree (reference);


--
-- Name: idx_bookings_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant ON public.bookings USING btree (restaurant_id);


--
-- Name: idx_bookings_restaurant_date_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant_date_end ON public.bookings USING btree (restaurant_id, booking_date, end_at);


--
-- Name: idx_bookings_restaurant_date_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_restaurant_date_start ON public.bookings USING btree (restaurant_id, booking_date, start_at);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (restaurant_id, status);


--
-- Name: idx_bta_booking_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bta_booking_end ON public.booking_table_assignments USING btree (booking_id, end_at);


--
-- Name: idx_bta_booking_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bta_booking_start ON public.booking_table_assignments USING btree (booking_id, start_at);


--
-- Name: idx_customer_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profiles_updated_at ON public.customer_profiles USING btree (updated_at DESC);


--
-- Name: idx_customers_auth_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_auth_user ON public.customers USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_customers_email_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email_normalized ON public.customers USING btree (restaurant_id, email_normalized);


--
-- Name: idx_customers_phone_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone_normalized ON public.customers USING btree (restaurant_id, phone_normalized);


--
-- Name: idx_customers_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_restaurant ON public.customers USING btree (restaurant_id);


--
-- Name: idx_customers_user_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_profile_id ON public.customers USING btree (user_profile_id);


--
-- Name: idx_demand_profiles_restaurant_day_window; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_restaurant_day_window ON public.demand_profiles USING btree (restaurant_id, day_of_week, service_window);


--
-- Name: idx_demand_profiles_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_profiles_updated_at ON public.demand_profiles USING btree (updated_at);


--
-- Name: idx_memberships_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_restaurant ON public.restaurant_memberships USING btree (restaurant_id);


--
-- Name: idx_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user ON public.restaurant_memberships USING btree (user_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_profiles_has_access; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_has_access ON public.profiles USING btree (has_access);


--
-- Name: idx_restaurant_operating_hours_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_operating_hours_scope ON public.restaurant_operating_hours USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer), effective_date);


--
-- Name: idx_restaurant_service_periods_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_service_periods_scope ON public.restaurant_service_periods USING btree (restaurant_id, COALESCE((day_of_week)::integer, '-1'::integer));


--
-- Name: idx_restaurants_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_active ON public.restaurants USING btree (is_active);


--
-- Name: idx_restaurants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurants_slug ON public.restaurants USING btree (slug);


--
-- Name: idx_strategic_configs_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_strategic_configs_restaurant ON public.strategic_configs USING btree (restaurant_id);


--
-- Name: idx_table_holds_restaurant_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_end ON public.table_holds USING btree (restaurant_id, end_at);


--
-- Name: idx_table_holds_restaurant_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_expires ON public.table_holds USING btree (restaurant_id, expires_at);


--
-- Name: idx_table_holds_restaurant_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_holds_restaurant_start ON public.table_holds USING btree (restaurant_id, start_at);


--
-- Name: idx_table_inventory_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_lookup ON public.table_inventory USING btree (restaurant_id, status, capacity);


--
-- Name: INDEX idx_table_inventory_lookup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_lookup IS 'Fast lookup for available tables by restaurant and capacity';


--
-- Name: idx_table_inventory_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_inventory_section ON public.table_inventory USING btree (restaurant_id, section);


--
-- Name: INDEX idx_table_inventory_section; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_table_inventory_section IS 'Fast filtering by section for floor plan views';


--
-- Name: idx_table_scarcity_metrics_computed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_computed_at ON public.table_scarcity_metrics USING btree (computed_at);


--
-- Name: idx_table_scarcity_metrics_restaurant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_table_scarcity_metrics_restaurant_type ON public.table_scarcity_metrics USING btree (restaurant_id, table_type);


--
-- Name: idx_user_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email);


--
-- Name: idx_waiting_list_restaurant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiting_list_restaurant_date ON public.waiting_list USING btree (restaurant_id, booking_date);


--
-- Name: idx_waiting_list_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waiting_list_status ON public.waiting_list USING btree (status);


--
-- Name: merge_rules_from_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX merge_rules_from_to_idx ON public.merge_rules USING btree (from_a, from_b, to_capacity);


--
-- Name: observability_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observability_events_created_at_idx ON public.observability_events USING btree (created_at DESC);


--
-- Name: profile_update_requests_profile_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_update_requests_profile_key_idx ON public.profile_update_requests USING btree (profile_id, idempotency_key);


--
-- Name: restaurant_invites_pending_unique_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_pending_unique_email ON public.restaurant_invites USING btree (restaurant_id, email_normalized) WHERE (status = 'pending'::text);


--
-- Name: restaurant_invites_restaurant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_invites_restaurant_status_idx ON public.restaurant_invites USING btree (restaurant_id, status, expires_at DESC);


--
-- Name: restaurant_invites_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_invites_token_hash_key ON public.restaurant_invites USING btree (token_hash);


--
-- Name: table_adjacencies_canonical_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX table_adjacencies_canonical_unique ON public.table_adjacencies USING btree (LEAST(table_a, table_b), GREATEST(table_a, table_b));


--
-- Name: table_adjacencies_table_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_adjacencies_table_b_idx ON public.table_adjacencies USING btree (table_b);


--
-- Name: table_hold_members_table_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_members_table_idx ON public.table_hold_members USING btree (table_id);


--
-- Name: table_hold_windows_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_hold_windows_restaurant_idx ON public.table_hold_windows USING btree (restaurant_id);


--
-- Name: table_holds_active_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_active_booking_idx ON public.table_holds USING btree (booking_id) WHERE (status = 'active'::public.table_hold_status);


--
-- Name: table_holds_active_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_active_restaurant_idx ON public.table_holds USING btree (restaurant_id, start_at, end_at) WHERE (status = 'active'::public.table_hold_status);


--
-- Name: table_holds_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_booking_idx ON public.table_holds USING btree (booking_id);


--
-- Name: table_holds_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_expires_at_idx ON public.table_holds USING btree (expires_at);


--
-- Name: table_holds_restaurant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_restaurant_id_idx ON public.table_holds USING btree (restaurant_id);


--
-- Name: table_holds_restaurant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_restaurant_idx ON public.table_holds USING btree (restaurant_id, start_at, end_at, expires_at);


--
-- Name: table_holds_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_session_idx ON public.table_holds USING btree (session_id);


--
-- Name: table_holds_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_status_idx ON public.table_holds USING btree (status);


--
-- Name: table_holds_zone_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_holds_zone_start_idx ON public.table_holds USING btree (zone_id, start_at);


--
-- Name: table_inventory_restaurant_table_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX table_inventory_restaurant_table_number_key ON public.table_inventory USING btree (restaurant_id, lower(table_number));


--
-- Name: table_inventory_zone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX table_inventory_zone_idx ON public.table_inventory USING btree (zone_id);


--
-- Name: uniq_zones_restaurant_lower_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_zones_restaurant_lower_name ON public.zones USING btree (restaurant_id, lower(name));


--
-- Name: zones_restaurant_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX zones_restaurant_name_idx ON public.zones USING btree (restaurant_id, lower(name));


--
-- Name: zones_restaurant_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX zones_restaurant_name_key ON public.zones USING btree (restaurant_id, lower(name));


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: allocations allocations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allocations_set_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: allocations allocations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: allowed_capacities allowed_capacities_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allowed_capacities_set_updated_at BEFORE UPDATE ON public.allowed_capacities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: allowed_capacities allowed_capacities_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER allowed_capacities_touch_updated_at BEFORE UPDATE ON public.allowed_capacities FOR EACH ROW EXECUTE FUNCTION public.allowed_capacities_set_updated_at();


--
-- Name: booking_table_assignments bar_tables_drinks_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bar_tables_drinks_only BEFORE INSERT OR UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.enforce_bar_drinks_only();


--
-- Name: bookings booking_assignment_validation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_assignment_validation BEFORE UPDATE ON public.bookings FOR EACH ROW WHEN ((new.status = 'confirmed'::public.booking_status)) EXECUTE FUNCTION public.validate_booking_has_assignments();


--
-- Name: booking_occasions booking_occasions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_occasions_set_updated_at BEFORE UPDATE ON public.booking_occasions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: booking_slots booking_slots_increment_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_increment_version BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.increment_booking_slot_version();


--
-- Name: booking_slots booking_slots_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_set_updated_at BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: booking_slots booking_slots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_slots_updated_at BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: booking_table_assignments booking_table_assignments_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_audit AFTER INSERT OR DELETE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.log_table_assignment_change();


--
-- Name: booking_table_assignments booking_table_assignments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_set_updated_at BEFORE UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: booking_table_assignments booking_table_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_table_assignments_updated_at BEFORE UPDATE ON public.booking_table_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: bookings bookings_set_instants; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_instants BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, restaurant_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_instants();


--
-- Name: bookings bookings_set_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_reference BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_reference();


--
-- Name: bookings bookings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: capacity_outbox capacity_outbox_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER capacity_outbox_set_updated_at BEFORE UPDATE ON public.capacity_outbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customer_profiles customer_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_profiles_set_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers customers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: feature_flag_overrides feature_flag_overrides_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feature_flag_overrides_set_updated_at BEFORE UPDATE ON public.feature_flag_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: merge_rules merge_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER merge_rules_updated_at BEFORE UPDATE ON public.merge_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: restaurant_invites restaurant_invites_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_invites_set_updated_at BEFORE UPDATE ON public.restaurant_invites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: restaurant_operating_hours restaurant_operating_hours_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_operating_hours_set_updated_at BEFORE UPDATE ON public.restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: restaurant_operating_hours restaurant_operating_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_operating_hours_updated_at BEFORE UPDATE ON public.restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurant_service_periods restaurant_service_periods_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_service_periods_set_updated_at BEFORE UPDATE ON public.restaurant_service_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: restaurant_service_periods restaurant_service_periods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurant_service_periods_updated_at BEFORE UPDATE ON public.restaurant_service_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurants restaurants_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_set_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: restaurants restaurants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: service_policy service_policy_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_policy_set_updated_at BEFORE UPDATE ON public.service_policy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_policy service_policy_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_policy_updated_at BEFORE UPDATE ON public.service_policy FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: restaurant_invites set_restaurant_invites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_restaurant_invites_updated_at BEFORE UPDATE ON public.restaurant_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: table_adjacencies table_adjacencies_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_adjacencies_validate BEFORE INSERT ON public.table_adjacencies FOR EACH ROW EXECUTE FUNCTION public.validate_table_adjacency();


--
-- Name: table_hold_members table_hold_members_sync_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_delete AFTER DELETE ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- Name: table_hold_members table_hold_members_sync_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_hold_members_sync_insert AFTER INSERT ON public.table_hold_members FOR EACH ROW EXECUTE FUNCTION public.sync_table_hold_windows();


--
-- Name: table_holds table_holds_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_set_updated_at BEFORE UPDATE ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_holds table_holds_sync_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_sync_update AFTER UPDATE OF start_at, end_at, expires_at, restaurant_id, booking_id ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();


--
-- Name: table_holds table_holds_sync_windows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_holds_sync_windows AFTER UPDATE ON public.table_holds FOR EACH ROW EXECUTE FUNCTION public.update_table_hold_windows();


--
-- Name: table_inventory table_inventory_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_inventory_set_updated_at BEFORE UPDATE ON public.table_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: table_inventory table_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER table_inventory_updated_at BEFORE UPDATE ON public.table_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: allocations trg_allocations_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_allocations_refresh AFTER INSERT OR DELETE OR UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.on_allocations_refresh();


--
-- Name: bookings trg_booking_status_refresh; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_status_refresh AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.on_booking_status_refresh();


--
-- Name: capacity_outbox trg_capacity_outbox_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_capacity_outbox_updated_at BEFORE UPDATE ON public.capacity_outbox FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: demand_profiles update_demand_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_demand_profiles_updated_at BEFORE UPDATE ON public.demand_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: strategic_configs update_strategic_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_strategic_configs_updated_at BEFORE UPDATE ON public.strategic_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: waiting_list update_waiting_list_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_waiting_list_updated_at BEFORE UPDATE ON public.waiting_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zones zones_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zones_set_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: zones zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: allocations allocations_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: allowed_capacities allowed_capacities_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowed_capacities
    ADD CONSTRAINT allowed_capacities_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: analytics_events analytics_events_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: booking_assignment_attempts booking_assignment_attempts_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_attempts
    ADD CONSTRAINT booking_assignment_attempts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_assignment_idempotency booking_assignment_idempotency_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_idempotency
    ADD CONSTRAINT booking_assignment_idempotency_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_assignment_state_history booking_assignment_state_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_assignment_state_history
    ADD CONSTRAINT booking_assignment_state_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_service_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_service_period_id_fkey FOREIGN KEY (service_period_id) REFERENCES public.restaurant_service_periods(id) ON DELETE SET NULL;


--
-- Name: booking_state_history booking_state_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_state_history booking_state_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_state_history
    ADD CONSTRAINT booking_state_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_table_assignments booking_table_assignments_merge_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_merge_group_id_fkey FOREIGN KEY (merge_group_id) REFERENCES public.allocations(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.booking_slots(id) ON DELETE SET NULL;


--
-- Name: booking_table_assignments booking_table_assignments_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_table_assignments
    ADD CONSTRAINT booking_table_assignments_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE RESTRICT;


--
-- Name: booking_versions booking_versions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_versions booking_versions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_versions
    ADD CONSTRAINT booking_versions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_assigned_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_zone_id_fkey FOREIGN KEY (assigned_zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_booking_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_type_fkey FOREIGN KEY (booking_type) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: demand_profiles demand_profiles_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_profiles
    ADD CONSTRAINT demand_profiles_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: profile_update_requests profile_update_requests_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_update_requests
    ADD CONSTRAINT profile_update_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_invites restaurant_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: restaurant_invites restaurant_invites_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_invites
    ADD CONSTRAINT restaurant_invites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_memberships restaurant_memberships_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_memberships
    ADD CONSTRAINT restaurant_memberships_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_operating_hours restaurant_operating_hours_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_operating_hours
    ADD CONSTRAINT restaurant_operating_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_service_periods restaurant_service_periods_booking_option_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_booking_option_fkey FOREIGN KEY (booking_option) REFERENCES public.booking_occasions(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: restaurant_service_periods restaurant_service_periods_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_service_periods
    ADD CONSTRAINT restaurant_service_periods_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: strategic_configs strategic_configs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_configs
    ADD CONSTRAINT strategic_configs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_adjacencies table_adjacencies_table_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_a_fkey FOREIGN KEY (table_a) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_adjacencies table_adjacencies_table_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_adjacencies
    ADD CONSTRAINT table_adjacencies_table_b_fkey FOREIGN KEY (table_b) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_hold_members table_hold_members_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- Name: table_hold_members table_hold_members_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_members
    ADD CONSTRAINT table_hold_members_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_hold_windows table_hold_windows_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.table_holds(id) ON DELETE CASCADE;


--
-- Name: table_hold_windows table_hold_windows_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_hold_windows table_hold_windows_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_hold_windows
    ADD CONSTRAINT table_hold_windows_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.table_inventory(id) ON DELETE CASCADE;


--
-- Name: table_holds table_holds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: table_holds table_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: table_holds table_holds_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_holds table_holds_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_holds
    ADD CONSTRAINT table_holds_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: table_inventory table_inventory_allowed_capacity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_allowed_capacity_fk FOREIGN KEY (restaurant_id, capacity) REFERENCES public.allowed_capacities(restaurant_id, capacity) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: table_inventory table_inventory_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: table_inventory table_inventory_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_inventory
    ADD CONSTRAINT table_inventory_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE RESTRICT;


--
-- Name: table_scarcity_metrics table_scarcity_metrics_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.table_scarcity_metrics
    ADD CONSTRAINT table_scarcity_metrics_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: waiting_list waiting_list_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_list
    ADD CONSTRAINT waiting_list_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: zones zones_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings Admins and owners can delete bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete bookings" ON public.bookings FOR DELETE USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: customers Admins and owners can delete customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and owners can delete customers" ON public.customers FOR DELETE USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: booking_occasions Allow public read access to booking_occasions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to booking_occasions" ON public.booking_occasions FOR SELECT USING (true);


--
-- Name: booking_table_assignments Customers can view their table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their table assignments" ON public.booking_table_assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND ((b.auth_user_id = auth.uid()) OR (b.customer_id IN ( SELECT customers.id
           FROM public.customers
          WHERE (customers.auth_user_id = auth.uid()))))))));


--
-- Name: restaurant_memberships Owners and admins can manage memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can manage memberships" ON public.restaurant_memberships USING ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants_admin() AS user_restaurants_admin)));


--
-- Name: demand_profiles Owners and managers can manage demand profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage demand profiles" ON public.demand_profiles USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = demand_profiles.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text]))))));


--
-- Name: table_scarcity_metrics Owners and managers can manage scarcity metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers can manage scarcity metrics" ON public.table_scarcity_metrics USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = table_scarcity_metrics.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'admin'::text]))))));


--
-- Name: restaurant_invites Owners and managers manage invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and managers manage invites" ON public.restaurant_invites USING ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text])))))) WITH CHECK ((restaurant_id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: booking_slots Public can view booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view booking slots" ON public.booking_slots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurants r
  WHERE ((r.id = booking_slots.restaurant_id) AND (r.is_active = true)))));


--
-- Name: table_inventory Public can view table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view table inventory" ON public.table_inventory FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurants r
  WHERE ((r.id = table_inventory.restaurant_id) AND (r.is_active = true)))));


--
-- Name: waiting_list Restaurant members can manage waiting list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant members can manage waiting list" ON public.waiting_list USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = waiting_list.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: booking_versions Restaurant members can view booking versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant members can view booking versions" ON public.booking_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = booking_versions.restaurant_id) AND (rm.user_id = auth.uid())))));


--
-- Name: strategic_configs Restaurant owners can manage strategic configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Restaurant owners can manage strategic configs" ON public.strategic_configs USING ((EXISTS ( SELECT 1
   FROM public.restaurant_memberships rm
  WHERE ((rm.restaurant_id = strategic_configs.restaurant_id) AND (rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));


--
-- Name: table_adjacencies Service role can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage adjacencies" ON public.table_adjacencies TO service_role USING (true) WITH CHECK (true);


--
-- Name: allowed_capacities Service role can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage allowed capacities" ON public.allowed_capacities TO service_role USING (true) WITH CHECK (true);


--
-- Name: booking_occasions_audit Service role can manage audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit" ON public.booking_occasions_audit USING (true) WITH CHECK (true);


--
-- Name: audit_logs Service role can manage audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit logs" ON public.audit_logs USING (true) WITH CHECK (true);


--
-- Name: booking_slots Service role can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage booking slots" ON public.booking_slots TO service_role USING (true) WITH CHECK (true);


--
-- Name: customer_profiles Service role can manage customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage customer profiles" ON public.customer_profiles USING (true) WITH CHECK (true);


--
-- Name: merge_rules Service role can manage merge rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage merge rules" ON public.merge_rules USING (true) WITH CHECK (true);


--
-- Name: restaurant_operating_hours Service role can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage operating hours" ON public.restaurant_operating_hours TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles Service role can manage profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage profiles" ON public.profiles USING (true) WITH CHECK (true);


--
-- Name: restaurant_service_periods Service role can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service periods" ON public.restaurant_service_periods TO service_role USING (true) WITH CHECK (true);


--
-- Name: service_policy Service role can manage service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage service policy" ON public.service_policy TO service_role USING (true) WITH CHECK (true);


--
-- Name: table_inventory Service role can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage table inventory" ON public.table_inventory TO service_role USING (true) WITH CHECK (true);


--
-- Name: zones Service role can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage zones" ON public.zones TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_events Service role full access to analytics_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to analytics_events" ON public.analytics_events USING (true) WITH CHECK (true);


--
-- Name: booking_assignment_idempotency Service role full access to booking_assignment_idempotency; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to booking_assignment_idempotency" ON public.booking_assignment_idempotency USING (true) WITH CHECK (true);


--
-- Name: booking_versions Service role full access to booking_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to booking_versions" ON public.booking_versions USING (true) WITH CHECK (true);


--
-- Name: feature_flag_overrides Service role full access to feature_flag_overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to feature_flag_overrides" ON public.feature_flag_overrides USING (true) WITH CHECK (true);


--
-- Name: leads Service role full access to leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to leads" ON public.leads USING (true) WITH CHECK (true);


--
-- Name: strategic_configs Service role full access to strategic_configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to strategic_configs" ON public.strategic_configs USING (true) WITH CHECK (true);


--
-- Name: table_hold_members Service role full access to table_hold_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to table_hold_members" ON public.table_hold_members USING (true) WITH CHECK (true);


--
-- Name: table_hold_windows Service role full access to table_hold_windows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to table_hold_windows" ON public.table_hold_windows USING (true) WITH CHECK (true);


--
-- Name: user_profiles Service role full access to user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to user_profiles" ON public.user_profiles USING (true) WITH CHECK (true);


--
-- Name: waiting_list Service role full access to waiting_list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to waiting_list" ON public.waiting_list USING (true) WITH CHECK (true);


--
-- Name: bookings Staff can create bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create bookings" ON public.bookings FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customers Staff can create customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create customers" ON public.customers FOR INSERT WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: table_adjacencies Staff can manage adjacencies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage adjacencies" ON public.table_adjacencies TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.table_inventory ti
  WHERE ((ti.id = table_adjacencies.table_a) AND (ti.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: allowed_capacities Staff can manage allowed capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage allowed capacities" ON public.allowed_capacities TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: booking_slots Staff can manage booking slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage booking slots" ON public.booking_slots USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: restaurant_operating_hours Staff can manage operating hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage operating hours" ON public.restaurant_operating_hours USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: restaurant_service_periods Staff can manage service periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage service periods" ON public.restaurant_service_periods USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: booking_table_assignments Staff can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table assignments" ON public.booking_table_assignments USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: table_inventory Staff can manage table inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage table inventory" ON public.table_inventory USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: zones Staff can manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage zones" ON public.zones TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))) WITH CHECK ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: bookings Staff can update bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customers Staff can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update customers" ON public.customers FOR UPDATE USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: allocations Staff can view allocations for their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view allocations for their restaurants" ON public.allocations FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: bookings Staff can view bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view bookings" ON public.bookings FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: customer_profiles Staff can view customer profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customer profiles" ON public.customer_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_profiles.customer_id) AND (c.restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants))))));


--
-- Name: customers Staff can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view customers" ON public.customers FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: merge_rules Staff can view merge rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view merge rules" ON public.merge_rules FOR SELECT USING (true);


--
-- Name: service_policy Staff can view service policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view service policy" ON public.service_policy FOR SELECT TO authenticated USING (true);


--
-- Name: table_holds Staff can view table holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view table holds" ON public.table_holds FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: allocations Tenant service role can manage allocations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage allocations" ON public.allocations TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- Name: bookings Tenant service role can manage bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage bookings" ON public.bookings TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- Name: capacity_outbox Tenant service role can manage capacity outbox; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage capacity outbox" ON public.capacity_outbox TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- Name: customers Tenant service role can manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage customers" ON public.customers TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- Name: table_holds Tenant service role can manage holds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage holds" ON public.table_holds TO service_role USING ((restaurant_id = public.require_restaurant_context())) WITH CHECK ((restaurant_id = public.require_restaurant_context()));


--
-- Name: booking_table_assignments Tenant service role can manage table assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tenant service role can manage table assignments" ON public.booking_table_assignments TO service_role USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id = public.require_restaurant_context()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = booking_table_assignments.booking_id) AND (b.restaurant_id = public.require_restaurant_context())))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: restaurant_memberships Users can view memberships in their restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view memberships in their restaurants" ON public.restaurant_memberships FOR SELECT USING ((restaurant_id IN ( SELECT public.user_restaurants() AS user_restaurants)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: allowed_capacities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allowed_capacities ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants anon_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_read_all ON public.restaurants FOR SELECT TO anon USING (true);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants authenticated_can_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_can_create ON public.restaurants FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: restaurants authenticated_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_all ON public.restaurants FOR SELECT TO authenticated USING (true);


--
-- Name: booking_assignment_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_assignment_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_occasions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_occasions ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_occasions_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_occasions_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_table_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_table_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: capacity_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capacity_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: demand_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demand_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flag_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: merge_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.merge_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants owners_admins_can_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_admins_can_update ON public.restaurants FOR UPDATE TO authenticated USING ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text])))))) WITH CHECK ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));


--
-- Name: restaurants owners_can_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owners_can_delete ON public.restaurants FOR DELETE TO authenticated USING ((id IN ( SELECT rm.restaurant_id
   FROM public.restaurant_memberships rm
  WHERE ((rm.user_id = auth.uid()) AND (rm.role = 'owner'::text)))));


--
-- Name: profile_update_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_update_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_update_requests profile_update_requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_delete ON public.profile_update_requests FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_insert ON public.profile_update_requests FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_select ON public.profile_update_requests FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: profile_update_requests profile_update_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_update_requests_update ON public.profile_update_requests FOR UPDATE USING ((auth.uid() = profile_id)) WITH CHECK ((auth.uid() = profile_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_operating_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_service_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_service_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- Name: service_policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_policy ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants service_role_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_access ON public.restaurants TO service_role USING (true) WITH CHECK (true);


--
-- Name: restaurants service_role_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_read_all ON public.restaurants FOR SELECT TO service_role USING (true);


--
-- Name: strategic_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.strategic_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: table_adjacencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_adjacencies ENABLE ROW LEVEL SECURITY;

--
-- Name: table_hold_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_hold_members ENABLE ROW LEVEL SECURITY;

--
-- Name: table_hold_windows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_hold_windows ENABLE ROW LEVEL SECURITY;

--
-- Name: table_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: table_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: table_scarcity_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.table_scarcity_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: waiting_list; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

--
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict 1jFnHMaakqLCR8tJoIPd0vUTOq0AexO1GGfjEaG7p14pU6r3aLKFX1Q53VBfpRS

