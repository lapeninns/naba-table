-- Migration: Create Booking Slots
-- Description: Adds booking_slots table for pre-materialized time slot capacity tracking
-- Story: Capacity & Availability Engine - Story 1
-- Date: 2025-10-16

-- =====================================================
-- 1. Create booking_slots table
-- =====================================================
CREATE TABLE IF NOT EXISTS "public"."booking_slots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "slot_date" "date" NOT NULL,
    "slot_time" time without time zone NOT NULL,
    "service_period_id" "uuid",
    "available_capacity" integer NOT NULL DEFAULT 0,
    "reserved_count" integer NOT NULL DEFAULT 0,
    "version" integer NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    -- Constraints
    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_slots_restaurant_slot_key" UNIQUE ("restaurant_id", "slot_date", "slot_time"),
    CONSTRAINT "booking_slots_capacity_valid" CHECK (("reserved_count" >= 0 AND "reserved_count" <= "available_capacity")),
    CONSTRAINT "booking_slots_available_capacity_positive" CHECK (("available_capacity" >= 0)),
    
    -- Foreign keys
    CONSTRAINT "booking_slots_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE,
    CONSTRAINT "booking_slots_service_period_id_fkey" FOREIGN KEY ("service_period_id") REFERENCES "public"."restaurant_service_periods"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."booking_slots" OWNER TO "postgres";

COMMENT ON TABLE "public"."booking_slots" IS 'Pre-materialized time slots with capacity counters for fast availability checks. Created on-demand or pre-generated.';

COMMENT ON COLUMN "public"."booking_slots"."slot_date" IS 'Date of the slot (e.g., 2025-10-20)';
COMMENT ON COLUMN "public"."booking_slots"."slot_time" IS 'Time of the slot (e.g., 19:00). Typically 15/30/60 minute intervals.';
COMMENT ON COLUMN "public"."booking_slots"."service_period_id" IS 'Optional link to service period (lunch/dinner). Null if not applicable.';
COMMENT ON COLUMN "public"."booking_slots"."available_capacity" IS 'Maximum capacity for this slot (in covers/guests). Derived from capacity rules.';
COMMENT ON COLUMN "public"."booking_slots"."reserved_count" IS 'Number of covers/guests currently reserved for this slot.';
COMMENT ON COLUMN "public"."booking_slots"."version" IS 'Optimistic locking version. Incremented on each update to prevent race conditions.';

-- =====================================================
-- 2. Create indexes
-- =====================================================
CREATE INDEX "idx_booking_slots_lookup" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date", "slot_time");

CREATE INDEX "idx_booking_slots_date_range" ON "public"."booking_slots" USING "btree" ("restaurant_id", "slot_date");

CREATE INDEX "idx_booking_slots_service_period" ON "public"."booking_slots" USING "btree" ("service_period_id", "slot_date");

COMMENT ON INDEX "public"."idx_booking_slots_lookup" IS 'Fast lookup for specific slot (primary use case)';
COMMENT ON INDEX "public"."idx_booking_slots_date_range" IS 'Fast queries for all slots on a given date';
COMMENT ON INDEX "public"."idx_booking_slots_service_period" IS 'Fast queries by service period (e.g., all lunch slots)';

-- =====================================================
-- 3. Create updated_at trigger
-- =====================================================
CREATE TRIGGER "booking_slots_updated_at" 
    BEFORE UPDATE ON "public"."booking_slots" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."update_updated_at"();

-- =====================================================
-- 4. Create version increment trigger (for optimistic locking)
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."increment_booking_slot_version"()
RETURNS TRIGGER
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

ALTER FUNCTION "public"."increment_booking_slot_version"() OWNER TO "postgres";

CREATE TRIGGER "booking_slots_increment_version" 
    BEFORE UPDATE ON "public"."booking_slots" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."increment_booking_slot_version"();

COMMENT ON FUNCTION "public"."increment_booking_slot_version"() IS 'Automatically increment version column when reserved_count changes (optimistic concurrency control)';

-- =====================================================
-- 5. Helper function: Get or create slot
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_slot"(
    p_restaurant_id uuid,
    p_slot_date date,
    p_slot_time time,
    p_default_capacity integer DEFAULT 999
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot_id uuid;
    v_service_period_id uuid;
    v_capacity integer;
BEGIN
    -- Try to find existing slot
    SELECT id INTO v_slot_id
    FROM booking_slots
    WHERE restaurant_id = p_restaurant_id
        AND slot_date = p_slot_date
        AND slot_time = p_slot_time;
    
    IF FOUND THEN
        RETURN v_slot_id;
    END IF;
    
    -- Find applicable service period
    SELECT id INTO v_service_period_id
    FROM restaurant_service_periods
    WHERE restaurant_id = p_restaurant_id
        AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
        AND p_slot_time >= start_time
        AND p_slot_time < end_time
    ORDER BY day_of_week DESC NULLS LAST
    LIMIT 1;
    
    -- Get capacity from rules (if exists)
    SELECT COALESCE(max_covers, p_default_capacity) INTO v_capacity
    FROM restaurant_capacity_rules
    WHERE restaurant_id = p_restaurant_id
        AND (service_period_id IS NULL OR service_period_id = v_service_period_id)
        AND (day_of_week IS NULL OR day_of_week = EXTRACT(DOW FROM p_slot_date)::smallint)
        AND (effective_date IS NULL OR effective_date <= p_slot_date)
    ORDER BY 
        effective_date DESC NULLS LAST,
        day_of_week DESC NULLS LAST,
        service_period_id DESC NULLS LAST
    LIMIT 1;
    
    -- Default capacity if no rule found
    v_capacity := COALESCE(v_capacity, p_default_capacity);
    
    -- Create new slot
    INSERT INTO booking_slots (
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
    RETURNING id INTO v_slot_id;
    
    RETURN v_slot_id;
END;
$$;

ALTER FUNCTION "public"."get_or_create_booking_slot"(uuid, date, time, integer) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_or_create_booking_slot"(uuid, date, time, integer) IS 'Get existing slot or create new one with capacity derived from rules. Used for lazy slot creation.';

-- =====================================================
-- 6. Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE "public"."booking_slots" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. Create RLS Policies
-- =====================================================

-- Policy 1: Service role has full access
CREATE POLICY "Service role can manage booking slots" 
    ON "public"."booking_slots" 
    TO "service_role" 
    USING (true) 
    WITH CHECK (true);

-- Policy 2: Authenticated staff can view and manage slots for their restaurants
CREATE POLICY "Staff can manage booking slots" 
    ON "public"."booking_slots" 
    USING (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants"))) 
    WITH CHECK (("restaurant_id" IN ( SELECT "public"."user_restaurants"() AS "user_restaurants")));

-- Policy 3: Public can view slots for availability checks (read-only)
CREATE POLICY "Public can view booking slots" 
    ON "public"."booking_slots" 
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM "public"."restaurants" "r"
            WHERE "r"."id" = "booking_slots"."restaurant_id" 
                AND "r"."is_active" = true
        )
    );

-- =====================================================
-- 8. Grant permissions
-- =====================================================
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_slots" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_slots" TO "authenticated";
GRANT SELECT ON TABLE "public"."booking_slots" TO "anon";

-- =====================================================
-- Migration complete
-- =====================================================
-- Next migration: 20251016092000_create_booking_table_assignments.sql
