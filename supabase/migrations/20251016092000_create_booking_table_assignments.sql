-- Migration: Create Booking Table Assignments
-- Description: Adds booking_table_assignments table to link bookings to physical tables
-- Story: Capacity & Availability Engine - Story 1
-- Date: 2025-10-16

-- =====================================================
-- 1. Create booking_table_assignments table
-- =====================================================
CREATE TABLE IF NOT EXISTS "public"."booking_table_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "slot_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    -- Constraints
    CONSTRAINT "booking_table_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_table_assignments_booking_table_key" UNIQUE ("booking_id", "table_id"),
    
    -- Foreign keys
    CONSTRAINT "booking_table_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE,
    CONSTRAINT "booking_table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table_inventory"("id") ON DELETE RESTRICT,
    CONSTRAINT "booking_table_assignments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."booking_slots"("id") ON DELETE SET NULL,
    CONSTRAINT "booking_table_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."booking_table_assignments" OWNER TO "postgres";

COMMENT ON TABLE "public"."booking_table_assignments" IS 'Links bookings to physical tables. A booking can have multiple tables (e.g., party of 10 = 2x 6-tops).';

COMMENT ON COLUMN "public"."booking_table_assignments"."booking_id" IS 'The booking being assigned a table';
COMMENT ON COLUMN "public"."booking_table_assignments"."table_id" IS 'The physical table being assigned';
COMMENT ON COLUMN "public"."booking_table_assignments"."slot_id" IS 'Optional link to the booking slot (for slot-level tracking)';
COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_at" IS 'When the assignment was made';
COMMENT ON COLUMN "public"."booking_table_assignments"."assigned_by" IS 'User who made the assignment (null for auto-assignment)';
COMMENT ON COLUMN "public"."booking_table_assignments"."notes" IS 'Optional notes about the assignment (e.g., "VIP preferred seating")';

-- =====================================================
-- 2. Create indexes
-- =====================================================
CREATE INDEX "idx_booking_table_assignments_booking" ON "public"."booking_table_assignments" USING "btree" ("booking_id");

CREATE INDEX "idx_booking_table_assignments_table" ON "public"."booking_table_assignments" USING "btree" ("table_id", "assigned_at");

CREATE INDEX "idx_booking_table_assignments_slot" ON "public"."booking_table_assignments" USING "btree" ("slot_id");

COMMENT ON INDEX "public"."idx_booking_table_assignments_booking" IS 'Fast lookup of tables assigned to a booking';
COMMENT ON INDEX "public"."idx_booking_table_assignments_table" IS 'Fast lookup of bookings using a table (for reservation timeline)';
COMMENT ON INDEX "public"."idx_booking_table_assignments_slot" IS 'Fast lookup of assignments per slot';

-- =====================================================
-- 3. Create updated_at trigger
-- =====================================================
CREATE TRIGGER "booking_table_assignments_updated_at" 
    BEFORE UPDATE ON "public"."booking_table_assignments" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."update_updated_at"();

-- =====================================================
-- 4. Create audit trail trigger (log assignment changes)
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."log_table_assignment_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION "public"."log_table_assignment_change"() OWNER TO "postgres";

CREATE TRIGGER "booking_table_assignments_audit" 
    AFTER INSERT OR DELETE ON "public"."booking_table_assignments" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."log_table_assignment_change"();

COMMENT ON FUNCTION "public"."log_table_assignment_change"() IS 'Audit trail for table assignment changes (who assigned what table to which booking)';

-- =====================================================
-- 5. Helper function: Assign table to booking
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."assign_table_to_booking"(
    p_booking_id uuid,
    p_table_id uuid,
    p_assigned_by uuid DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment_id uuid;
    v_restaurant_id uuid;
    v_booking_date date;
    v_start_time time;
    v_slot_id uuid;
BEGIN
    -- Verify booking exists and get details
    SELECT restaurant_id, booking_date, start_time 
    INTO v_restaurant_id, v_booking_date, v_start_time
    FROM bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found: %', p_booking_id;
    END IF;
    
    -- Verify table exists and belongs to same restaurant
    IF NOT EXISTS (
        SELECT 1 FROM table_inventory
        WHERE id = p_table_id AND restaurant_id = v_restaurant_id
    ) THEN
        RAISE EXCEPTION 'Table not found or belongs to different restaurant: %', p_table_id;
    END IF;
    
    -- Get or create booking slot
    SELECT id INTO v_slot_id
    FROM booking_slots
    WHERE restaurant_id = v_restaurant_id
        AND slot_date = v_booking_date
        AND slot_time = v_start_time;
    
    -- Create assignment
    INSERT INTO booking_table_assignments (
        booking_id,
        table_id,
        slot_id,
        assigned_by,
        notes
    ) VALUES (
        p_booking_id,
        p_table_id,
        v_slot_id,
        p_assigned_by,
        p_notes
    )
    ON CONFLICT (booking_id, table_id) DO UPDATE
    SET assigned_by = EXCLUDED.assigned_by,
        notes = EXCLUDED.notes,
        assigned_at = now()
    RETURNING id INTO v_assignment_id;
    
    -- Update table status to reserved
    UPDATE table_inventory
    SET status = 'reserved'::table_status
    WHERE id = p_table_id;
    
    RETURN v_assignment_id;
END;
$$;

ALTER FUNCTION "public"."assign_table_to_booking"(uuid, uuid, uuid, text) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."assign_table_to_booking"(uuid, uuid, uuid, text) IS 'Assign a table to a booking. Updates table status to reserved. Returns assignment ID.';

-- =====================================================
-- 6. Helper function: Unassign table from booking
-- =====================================================
CREATE OR REPLACE FUNCTION "public"."unassign_table_from_booking"(
    p_booking_id uuid,
    p_table_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION "public"."unassign_table_from_booking"(uuid, uuid) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."unassign_table_from_booking"(uuid, uuid) IS 'Remove table assignment from booking. Updates table status to available if no other active bookings.';

-- =====================================================
-- 7. Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE "public"."booking_table_assignments" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. Create RLS Policies
-- =====================================================

-- Policy 1: Service role has full access
CREATE POLICY "Service role can manage table assignments" 
    ON "public"."booking_table_assignments" 
    TO "service_role" 
    USING (true) 
    WITH CHECK (true);

-- Policy 2: Staff can manage assignments for their restaurants
CREATE POLICY "Staff can manage table assignments" 
    ON "public"."booking_table_assignments"
    USING (
        EXISTS (
            SELECT 1 
            FROM bookings b
            WHERE b.id = booking_table_assignments.booking_id
                AND b.restaurant_id IN (SELECT user_restaurants())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM bookings b
            WHERE b.id = booking_table_assignments.booking_id
                AND b.restaurant_id IN (SELECT user_restaurants())
        )
    );

-- Policy 3: Customers can view their own booking's table assignments
CREATE POLICY "Customers can view their table assignments" 
    ON "public"."booking_table_assignments"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM bookings b
            WHERE b.id = booking_table_assignments.booking_id
                AND (
                    b.auth_user_id = auth.uid()
                    OR b.customer_id IN (
                        SELECT id FROM customers WHERE auth_user_id = auth.uid()
                    )
                )
        )
    );

-- =====================================================
-- 9. Grant permissions
-- =====================================================
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_table_assignments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_table_assignments" TO "authenticated";
GRANT SELECT ON TABLE "public"."booking_table_assignments" TO "anon";

-- =====================================================
-- Migration complete
-- =====================================================
-- Next migration: 20251016092100_add_capacity_check_rpc.sql
