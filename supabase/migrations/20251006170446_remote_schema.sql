

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."analytics_event_type" AS ENUM (
    'booking.created',
    'booking.cancelled',
    'booking.allocated',
    'booking.waitlisted'
);


ALTER TYPE "public"."analytics_event_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_change_type" AS ENUM (
    'created',
    'updated',
    'cancelled',
    'deleted'
);


ALTER TYPE "public"."booking_change_type" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'confirmed',
    'pending',
    'cancelled',
    'completed',
    'no_show',
    'pending_allocation'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."booking_type" AS ENUM (
    'breakfast',
    'lunch',
    'dinner',
    'drinks'
);


ALTER TYPE "public"."booking_type" OWNER TO "postgres";


CREATE TYPE "public"."loyalty_tier" AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


ALTER TYPE "public"."loyalty_tier" OWNER TO "postgres";


CREATE TYPE "public"."seating_preference_type" AS ENUM (
    'any',
    'indoor',
    'outdoor',
    'bar',
    'window',
    'quiet',
    'booth'
);


ALTER TYPE "public"."seating_preference_type" OWNER TO "postgres";


CREATE TYPE "public"."seating_type" AS ENUM (
    'indoor',
    'outdoor',
    'bar',
    'patio',
    'private_room'
);


ALTER TYPE "public"."seating_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_reference"() RETURNS "text"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."generate_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_instants"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."set_booking_instants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_reference"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."set_booking_reference"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_restaurants"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."user_restaurants"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" "public"."analytics_event_type" NOT NULL,
    "schema_version" "text" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "emitted_by" "text" DEFAULT 'server'::"text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_versions" (
    "version_id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "change_type" "public"."booking_change_type" NOT NULL,
    "changed_by" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "party_size" integer NOT NULL,
    "seating_preference" "public"."seating_preference_type" DEFAULT 'any'::"public"."seating_preference_type" NOT NULL,
    "status" "public"."booking_status" DEFAULT 'confirmed'::"public"."booking_status" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "notes" "text",
    "reference" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "booking_type" "public"."booking_type" DEFAULT 'dinner'::"public"."booking_type" NOT NULL,
    "idempotency_key" "text",
    "client_request_id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "pending_ref" "text",
    "details" "jsonb",
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "chk_time_order" CHECK (("start_at" < "end_at"))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_profiles" (
    "customer_id" "uuid" NOT NULL,
    "first_booking_at" timestamp with time zone,
    "last_booking_at" timestamp with time zone,
    "total_bookings" integer DEFAULT 0 NOT NULL,
    "total_covers" integer DEFAULT 0 NOT NULL,
    "total_cancellations" integer DEFAULT 0 NOT NULL,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "last_marketing_opt_in_at" timestamp with time zone,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_profiles_total_bookings_check" CHECK (("total_bookings" >= 0)),
    CONSTRAINT "customer_profiles_total_cancellations_check" CHECK (("total_cancellations" >= 0)),
    CONSTRAINT "customer_profiles_total_covers_check" CHECK (("total_covers" >= 0))
);


ALTER TABLE "public"."customer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email_normalized" "text" GENERATED ALWAYS AS ("lower"(TRIM(BOTH FROM "email"))) STORED,
    "phone_normalized" "text" GENERATED ALWAYS AS ("regexp_replace"("phone", '[^0-9]+'::"text", ''::"text", 'g'::"text")) STORED,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customers_email_check" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "customers_phone_check" CHECK ((("length"("phone") >= 7) AND ("length"("phone") <= 20)))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_point_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "points_change" integer NOT NULL,
    "event_type" "text" NOT NULL,
    "schema_version" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_point_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_points" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "tier" "public"."loyalty_tier" DEFAULT 'bronze'::"public"."loyalty_tier" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_programs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "accrual_rule" "jsonb" DEFAULT '{"type": "per_guest", "base_points": 10, "points_per_guest": 5, "minimum_party_size": 1}'::"jsonb" NOT NULL,
    "tier_definitions" "jsonb" DEFAULT '[{"tier": "bronze", "min_points": 0}]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pilot_only" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."loyalty_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "phone" "text",
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_email_check" CHECK (("email" = "lower"("email")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_capacity_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "service_period_id" "uuid",
    "day_of_week" smallint,
    "effective_date" "date",
    "max_covers" integer,
    "max_parties" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_capacity_rules_non_negative" CHECK (((("max_covers" IS NULL) OR ("max_covers" >= 0)) AND (("max_parties" IS NULL) OR ("max_parties" >= 0)))),
    CONSTRAINT "restaurant_capacity_rules_scope" CHECK ((("service_period_id" IS NOT NULL) OR ("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL)))
);


ALTER TABLE "public"."restaurant_capacity_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_memberships" (
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_memberships_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'staff'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."restaurant_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_operating_hours" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "day_of_week" smallint,
    "effective_date" "date",
    "opens_at" time without time zone,
    "closes_at" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_operating_hours_scope" CHECK ((("day_of_week" IS NOT NULL) OR ("effective_date" IS NOT NULL))),
    CONSTRAINT "restaurant_operating_hours_time_order" CHECK (("is_closed" OR (("opens_at" IS NOT NULL) AND ("closes_at" IS NOT NULL) AND ("opens_at" < "closes_at"))))
);


ALTER TABLE "public"."restaurant_operating_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_service_periods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "day_of_week" smallint,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "restaurant_service_periods_time_order" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."restaurant_service_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Europe/London'::"text" NOT NULL,
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "booking_policy" "text",
    CONSTRAINT "restaurants_capacity_check" CHECK ((("capacity" IS NULL) OR ("capacity" > 0))),
    CONSTRAINT "restaurants_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_pkey" PRIMARY KEY ("version_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_reference_key" UNIQUE ("reference");



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("customer_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_email_phone_key" UNIQUE ("restaurant_id", "email_normalized", "phone_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_email_normalized_key" UNIQUE ("restaurant_id", "email_normalized");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_phone_normalized_key" UNIQUE ("restaurant_id", "phone_normalized");



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_restaurant_id_customer_id_key" UNIQUE ("restaurant_id", "customer_id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_pkey" PRIMARY KEY ("user_id", "restaurant_id");



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_analytics_events_booking_id" ON "public"."analytics_events" USING "btree" ("booking_id");



CREATE INDEX "idx_analytics_events_customer_id" ON "public"."analytics_events" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_analytics_events_event_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_occurred_at" ON "public"."analytics_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_analytics_events_restaurant_id" ON "public"."analytics_events" USING "btree" ("restaurant_id");



CREATE INDEX "idx_analytics_events_restaurant_occurred" ON "public"."analytics_events" USING "btree" ("restaurant_id", "occurred_at" DESC);



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity_id" ON "public"."audit_logs" USING "btree" ("entity", "entity_id");



CREATE INDEX "idx_booking_versions_booking_id" ON "public"."booking_versions" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_versions_changed_at" ON "public"."booking_versions" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_booking_versions_restaurant_id" ON "public"."booking_versions" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_client_request_id" ON "public"."bookings" USING "btree" ("client_request_id");



CREATE INDEX "idx_bookings_created" ON "public"."bookings" USING "btree" ("restaurant_id", "created_at" DESC);



CREATE INDEX "idx_bookings_customer" ON "public"."bookings" USING "btree" ("customer_id");



CREATE INDEX "idx_bookings_date" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_date");



CREATE INDEX "idx_bookings_datetime" ON "public"."bookings" USING "btree" ("restaurant_id", "start_at", "end_at");



CREATE INDEX "idx_bookings_idempotency_key" ON "public"."bookings" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_bookings_pending_ref" ON "public"."bookings" USING "btree" ("pending_ref") WHERE ("pending_ref" IS NOT NULL);



CREATE INDEX "idx_bookings_reference" ON "public"."bookings" USING "btree" ("reference");



CREATE INDEX "idx_bookings_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_customer_profiles_updated_at" ON "public"."customer_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_customers_auth_user" ON "public"."customers" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "idx_customers_email_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "email_normalized");



CREATE INDEX "idx_customers_phone_normalized" ON "public"."customers" USING "btree" ("restaurant_id", "phone_normalized");



CREATE INDEX "idx_customers_restaurant" ON "public"."customers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_loyalty_point_events_booking" ON "public"."loyalty_point_events" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "idx_loyalty_point_events_customer" ON "public"."loyalty_point_events" USING "btree" ("customer_id");



CREATE INDEX "idx_loyalty_points_restaurant_customer" ON "public"."loyalty_points" USING "btree" ("restaurant_id", "customer_id");



CREATE INDEX "idx_loyalty_programs_restaurant" ON "public"."loyalty_programs" USING "btree" ("restaurant_id");



CREATE INDEX "idx_memberships_restaurant" ON "public"."restaurant_memberships" USING "btree" ("restaurant_id");



CREATE INDEX "idx_memberships_user" ON "public"."restaurant_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_restaurant_capacity_rules_scope" ON "public"."restaurant_capacity_rules" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_operating_hours_scope" ON "public"."restaurant_operating_hours" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer), "effective_date");



CREATE INDEX "idx_restaurant_service_periods_scope" ON "public"."restaurant_service_periods" USING "btree" ("restaurant_id", COALESCE(("day_of_week")::integer, '-1'::integer));



CREATE INDEX "idx_restaurants_slug" ON "public"."restaurants" USING "btree" ("slug");



CREATE INDEX "idx_stripe_events_created_at" ON "public"."stripe_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stripe_events_event_id" ON "public"."stripe_events" USING "btree" ("event_id");



CREATE INDEX "idx_stripe_events_event_type" ON "public"."stripe_events" USING "btree" ("event_type");



CREATE INDEX "idx_stripe_events_processed" ON "public"."stripe_events" USING "btree" ("processed") WHERE ("processed" = false);



CREATE OR REPLACE TRIGGER "bookings_set_instants" BEFORE INSERT OR UPDATE OF "booking_date", "start_time", "end_time", "restaurant_id" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_instants"();



CREATE OR REPLACE TRIGGER "bookings_set_reference" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_reference"();



CREATE OR REPLACE TRIGGER "bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_capacity_rules_updated_at" BEFORE UPDATE ON "public"."restaurant_capacity_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_operating_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_operating_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurant_service_periods_updated_at" BEFORE UPDATE ON "public"."restaurant_service_periods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_loyalty_points_updated_at" BEFORE UPDATE ON "public"."loyalty_points" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_loyalty_programs_updated_at" BEFORE UPDATE ON "public"."loyalty_programs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_versions"
    ADD CONSTRAINT "booking_versions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_profiles"
    ADD CONSTRAINT "customer_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_points"
    ADD CONSTRAINT "loyalty_points_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_capacity_rules"
    ADD CONSTRAINT "restaurant_capacity_rules_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_memberships"
    ADD CONSTRAINT "restaurant_memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_operating_hours"
    ADD CONSTRAINT "restaurant_operating_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_service_periods"
    ADD CONSTRAINT "restaurant_service_periods_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and owners can delete bookings" ON "public"."bookings" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurant_memberships"."restaurant_id"
   FROM "public"."restaurant_memberships"
  WHERE (("restaurant_memberships"."user_id" = "auth"."uid"()) AND ("restaurant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins and owners can delete customers" ON "public"."customers" FOR DELETE USING (("restaurant_id" IN ( SELECT "restaurant_memberships"."restaurant_id"
   FROM "public"."restaurant_memberships"
  WHERE (("restaurant_memberships"."user_id" = "auth"."uid"()) AND ("restaurant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Owners and admins can manage memberships" ON "public"."restaurant_memberships" USING (("restaurant_id" IN ( SELECT "restaurant_memberships_1"."restaurant_id"
   FROM "public"."restaurant_memberships" "restaurant_memberships_1"
  WHERE (("restaurant_memberships_1"."user_id" = "auth"."uid"()) AND ("restaurant_memberships_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Restaurant staff can view analytics" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "analytics_events"."restaurant_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Restaurant staff can view booking versions" ON "public"."booking_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."restaurant_memberships" "rm"
  WHERE (("rm"."restaurant_id" = "booking_versions"."restaurant_id") AND ("rm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Service role can manage analytics events" ON "public"."analytics_events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage audit logs" ON "public"."audit_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage booking versions" ON "public"."booking_versions" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage capacity rules" ON "public"."restaurant_capacity_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage customer profiles" ON "public"."customer_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty events" ON "public"."loyalty_point_events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty points" ON "public"."loyalty_points" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage loyalty programs" ON "public"."loyalty_programs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage operating hours" ON "public"."restaurant_operating_hours" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage profiles" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage service periods" ON "public"."restaurant_service_periods" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage stripe events" ON "public"."stripe_events" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can create bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can create customers" ON "public"."customers" FOR INSERT WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage capacity rules" ON "public"."restaurant_capacity_rules" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage operating hours" ON "public"."restaurant_operating_hours" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can manage service periods" ON "public"."restaurant_service_periods" USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update bookings" ON "public"."bookings" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can update customers" ON "public"."customers" FOR UPDATE USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view bookings" ON "public"."bookings" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Staff can view customer profiles" ON "public"."customer_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_profiles"."customer_id") AND ("c"."restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))))));



CREATE POLICY "Staff can view customers" ON "public"."customers" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view memberships in their restaurants" ON "public"."restaurant_memberships" FOR SELECT USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_read_all" ON "public"."restaurants" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_create" ON "public"."restaurants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "authenticated_read_all" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."booking_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_point_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners_admins_can_update" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "restaurant_memberships"."restaurant_id"
   FROM "public"."restaurant_memberships"
  WHERE (("restaurant_memberships"."user_id" = "auth"."uid"()) AND ("restaurant_memberships"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners_can_delete" ON "public"."restaurants" FOR DELETE TO "authenticated" USING (("id" IN ( SELECT "restaurant_memberships"."restaurant_id"
   FROM "public"."restaurant_memberships"
  WHERE (("restaurant_memberships"."user_id" = "auth"."uid"()) AND ("restaurant_memberships"."role" = 'owner'::"text")))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_capacity_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_operating_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurant_service_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all_access" ON "public"."restaurants" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_read_all" ON "public"."restaurants" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."stripe_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO "anon";
GRANT ALL ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_instants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_reference"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_restaurants"() TO "service_role";


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."analytics_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_versions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bookings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bookings" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customer_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."customers" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_point_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_points" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_programs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_capacity_rules" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_capacity_rules" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_memberships" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_memberships" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_operating_hours" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_operating_hours" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_service_periods" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurant_service_periods" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurants" TO "authenticated";
GRANT SELECT ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stripe_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



























RESET ALL;
